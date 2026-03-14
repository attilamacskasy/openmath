"""Full 4-player multiplayer game simulation for OpenMath v4.0 testing."""
import asyncio, json, sys, io, urllib.request, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import websockets

API = 'http://localhost:8000/api'

def api(method, path, data=None, token=None):
    body_bytes = json.dumps(data).encode() if data else None
    r = urllib.request.Request(f'{API}{path}', body_bytes,
        {'Content-Type': 'application/json'} if body_bytes else {})
    if token:
        r.add_header('Authorization', f'Bearer {token}')
    r.method = method
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, json.loads(resp.read())
    except Exception as e:
        body = getattr(e, 'read', lambda: b'{}')()
        try:
            return getattr(e, 'code', 0), json.loads(body) if body else {}
        except Exception:
            return getattr(e, 'code', 0), {}

def login(email):
    _, body = api('POST', '/auth/login', {'email': email, 'password': 'Test1234!'})
    return body['accessToken']


async def run():
    # Step 1: Login all users
    print('=== LOGGING IN ===')
    tokens = {}
    for name, email in [
        ('Csinszka', 'csinszka@test.openmath.com'),
        ('Hajni', 'hajni@test.openmath.com'),
        ('Attila', 'attila@test.openmath.com'),
        ('Bernat', 'bernat@test.openmath.com'),
    ]:
        tokens[name] = login(email)
        print(f'  {name} logged in')

    # Step 2: Create game as Csinszka
    print('\n=== CREATING GAME ===')
    _, gb = api('POST', '/multiplayer/games', {
        'quizTypeCode': 'multiplication_1_10',
        'difficulty': 'medium',
        'totalQuestions': 5,
        'penaltySeconds': 10,
        'minPlayers': 2,
        'maxPlayers': 5,
    }, tokens['Csinszka'])
    gc = gb['gameCode']
    print(f'  Game code: {gc}')

    # Step 3: Join players via REST
    print('\n=== JOINING PLAYERS ===')
    for name in ['Hajni', 'Attila', 'Bernat']:
        code, body = api('POST', f'/multiplayer/games/{gc}/join', {}, tokens[name])
        print(f'  {name} joined: slot={body.get("player", {}).get("slot_number")}')

    # Step 4: Connect all 4 WebSockets (host + 3 players)
    print('\n=== CONNECTING WEBSOCKETS ===')
    conns = {}
    for name in ['Csinszka', 'Hajni', 'Attila', 'Bernat']:
        ws = await websockets.connect(
            f'ws://localhost:8000/ws/game/{gc}?token={tokens[name]}')
        conns[name] = ws
        print(f'  {name} WS connected')
    await asyncio.sleep(1)

    # Drain initial messages
    async def drain(ws, timeout=1):
        msgs = []
        while True:
            try:
                m = await asyncio.wait_for(ws.recv(), timeout=timeout)
                msgs.append(json.loads(m))
            except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
                break
        return msgs

    for name, ws in conns.items():
        await drain(ws)

    # Step 5: Send chat messages
    print('\n=== CHAT MESSAGES ===')
    for name in ['Hajni', 'Attila', 'Bernat']:
        await conns[name].send(json.dumps({
            'type': 'chat_message',
            'payload': {'text': f'Szia! {name} vagyok!'}
        }))
        print(f'  {name}: Szia! {name} vagyok!')
        await asyncio.sleep(0.5)

    await asyncio.sleep(1)
    # Drain chat broadcasts
    for ws in conns.values():
        await drain(ws, 0.5)

    # Step 6: Toggle ready
    print('\n=== SETTING READY ===')
    for name in ['Hajni', 'Attila', 'Bernat']:
        await conns[name].send(json.dumps({
            'type': 'player_ready',
            'payload': {'ready': True}
        }))
        print(f'  {name} -> READY')
        await asyncio.sleep(1)

    await asyncio.sleep(1)
    # Drain ready broadcasts
    for ws in conns.values():
        await drain(ws, 0.5)

    # PAUSE: Print game code for user to navigate to lobby
    print(f'\n{"="*50}')
    print(f'GAME CODE: {gc}')
    print(f'All 3 players are READY')
    print(f'Lobby URL: http://localhost:4200/multiplayer/lobby/{gc}')
    print(f'Please navigate to the lobby as Csinszka (host)')
    print(f'Then click "Jatek inditasa" (Start Game)')
    print(f'Or press Enter here to start via WebSocket...')
    print(f'{"="*50}')

    # Wait for user to start the game via UI, OR auto-start after 10s
    print('\nAuto-starting game in 10 seconds via host WS...')
    await asyncio.sleep(10)

    # Start game via host WebSocket
    print('\n=== STARTING GAME (via host WS) ===')
    await conns['Csinszka'].send(json.dumps({
        'type': 'start_game',
        'payload': {}
    }))

    # Wait for countdown ticks and game_started
    print('  Waiting for countdown...')
    questions = None
    for name in ['Hajni', 'Attila', 'Bernat']:
        ws = conns[name]
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=15)
                data = json.loads(msg)
                if data['type'] == 'countdown_tick':
                    if name == 'Hajni':
                        print(f'  Countdown: {data["payload"]["value"]}')
                elif data['type'] == 'game_started':
                    if questions is None:
                        questions = data['payload']['questions']
                    print(f'  {name} received game_started')
                    break
                elif data['type'] == 'error':
                    print(f'  ERROR: {data["payload"].get("message")}')
                    break
            except asyncio.TimeoutError:
                print(f'  {name} timed out waiting for game_started')
                break

    # Also drain host messages (countdown + game_started)
    host_msgs = await drain(conns['Csinszka'], 1)
    for m in host_msgs:
        if m['type'] == 'game_started' and questions is None:
            questions = m['payload']['questions']

    if not questions:
        print('FATAL: No questions received')
        for ws in conns.values():
            await ws.close()
        return

    # Compute correct answers from a * b (multiplication quiz)
    for q in questions:
        q['_correct'] = str(q.get('a', 0) * q.get('b', 0))

    print(f'\n=== QUESTIONS ({len(questions)}) ===')
    for q in questions:
        a = q.get('a', '?')
        b = q.get('b', '?')
        print(f'  Q{q["position"]}: {a} x {b} = {q["_correct"]}')

    # Step 7: Players answer
    print('\n=== PLAYERS ANSWERING ===')

    async def answer_as(name, ws, wrong_indices, base_delay):
        results = []
        for i, q in enumerate(questions):
            delay = base_delay + i * 0.3
            await asyncio.sleep(delay)
            correct = q['_correct']
            if i in wrong_indices:
                wrong_val = str(int(correct) + 1)
                await ws.send(json.dumps({
                    'type': 'submit_answer',
                    'payload': {'question_id': q['id'], 'value': wrong_val}
                }))
                # Get answer_result
                try:
                    r = await asyncio.wait_for(ws.recv(), timeout=3)
                    rd = json.loads(r)
                    if rd.get('type') == 'answer_result':
                        p = rd['payload']
                        print(f'  [{name}] Q{q["position"]}: {wrong_val} WRONG '
                              f'(penalty={p.get("penalty_ms",0)}ms)')
                        results.append(p)
                except asyncio.TimeoutError:
                    print(f'  [{name}] Q{q["position"]}: no response')
            else:
                await ws.send(json.dumps({
                    'type': 'submit_answer',
                    'payload': {'question_id': q['id'], 'value': correct}
                }))
                try:
                    r = await asyncio.wait_for(ws.recv(), timeout=3)
                    rd = json.loads(r)
                    if rd.get('type') == 'answer_result':
                        p = rd['payload']
                        print(f'  [{name}] Q{q["position"]}: {correct} CORRECT '
                              f'(total={p.get("total_time_ms",0)}ms)')
                        results.append(p)
                except asyncio.TimeoutError:
                    print(f'  [{name}] Q{q["position"]}: no response')
        return results

    # Run all 3 players concurrently
    all_results = await asyncio.gather(
        answer_as('Hajni', conns['Hajni'], [], 1.0),          # All correct, fast
        answer_as('Attila', conns['Attila'], [2], 2.0),       # 1 wrong (Q3)
        answer_as('Bernat', conns['Bernat'], [1, 3], 3.0),    # 2 wrong (Q2, Q4)
    )

    print('\n=== ALL PLAYERS FINISHED ===')
    await asyncio.sleep(3)

    # Drain remaining messages (host dashboard updates)
    for name, ws in conns.items():
        msgs = await drain(ws, 1)
        for m in msgs:
            if m['type'] in ('answer_update', 'position_update'):
                print(f'  [{name}] {m["type"]}: {m.get("payload", {})}')

    # Step 8: Host ends game
    print('\n=== HOST ENDING GAME ===')
    await conns['Csinszka'].send(json.dumps({
        'type': 'end_game',
        'payload': {}
    }))
    await asyncio.sleep(2)

    # Drain game_ended messages
    for name, ws in conns.items():
        msgs = await drain(ws, 1)
        for m in msgs:
            print(f'  [{name}] {m["type"]}')

    # Close all connections
    for name, ws in conns.items():
        await ws.close()

    print(f'\n=== GAME {gc} COMPLETE ===')
    print(f'Game code: {gc}')

asyncio.run(run())
