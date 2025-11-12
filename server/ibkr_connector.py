from fastapi import FastAPI
import socketio
from ib_insync import IB, Future, util
import asyncio
import os

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI()
sio_app = socketio.ASGIApp(sio, app)

ib = IB()
util.startLoop()

# Config
host = os.getenv('IBKR_HOST', '127.0.0.1')
port = int(os.getenv('IBKR_PORT', 4002))
client_id = int(os.getenv('IBKR_CLIENT_ID', 1))
symbol = os.getenv('SYMBOL', 'ES')
month = os.getenv('CONTRACT_MONTH', '202512')
mes_symbol = os.getenv('MES_SYMBOL', 'MES')
mes_month = os.getenv('MES_MONTH', '202512')

# Order Flow Engine
profile = {
    'levels': {}, 'poc': 0, 'vah': 0, 'val': 0,
    'total_volume': 0, 'buy_pressure': 0, 'sell_pressure': 0
}

@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")
    await ib.connectAsync(host, port, clientId=client_id)
    print(f"Connected to IB Gateway on {host}:{port}")
    await sio.emit('status', {'msg': 'IB GATEWAY LIVE - ESZ5 OBSERVATION'})

    # Resolve ES contract for observation
    contract = Future(symbol, month, 'GLOBEX')
    contracts = await ib.qualifyContractsAsync(contract)
    if not contracts:
        await sio.emit('error', {'msg': 'ESZ5 not found. Check IB Gateway'})
        return
    es_contract = contracts[0]
    print(f"ES Contract: {es_contract.localSymbol}")

    # Resolve MES contract for trading
    mes_contract = Future(mes_symbol, mes_month, 'GLOBEX')
    mes_contracts = await ib.qualifyContractsAsync(mes_contract)
    if mes_contracts:
        mes_contract = mes_contracts[0]
        print(f"MES Contract: {mes_contract.localSymbol}")
        await sio.emit('mes_ready', {'contract': mes_contract.localSymbol})

    # Request ES market data (observation)
    ib.reqMktData(es_contract, '', False, False)
    
    # Stream ticks
    async for tick in ib.pendingTickersEvent:
        if tick.bid and tick.ask:
            price = round((tick.bid + tick.ask) / 2, 2)
            volume = tick.volume or 0
            level = int(price)

            # Update profile
            profile['levels'][level] = profile['levels'].get(level, 0) + volume
            profile['total_volume'] += volume

            # 90/10 Pressure
            if price > tick.bid + 0.25:
                profile['buy_pressure'] += volume
            elif price < tick.ask - 0.25:
                profile['sell_pressure'] += volume

            # Recalculate every 500 contracts
            if profile['total_volume'] % 500 < 10:
                levels = sorted(profile['levels'].items(), key=lambda x: x[1], reverse=True)
                if levels:
                    profile['poc'] = levels[0][0]
                    total_70 = sum(v for _, v in levels) * 0.7
                    acc = 0
                    for p, v in levels:
                        acc += v
                        if acc >= total_70:
                            profile['vah'] = p
                            break
                    profile['val'] = levels[min(len(levels)-1, 5)][0] if len(levels) > 5 else profile['poc']

            # 90/10 Signal
            buy_ratio = profile['buy_pressure'] / max(profile['total_volume'], 1)
            sell_ratio = profile['sell_pressure'] / max(profile['total_volume'], 1)
            signal = 'BUY' if buy_ratio > 0.9 else 'SELL' if sell_ratio > 0.9 else 'NEUTRAL'

            # Send to UI (ES observation, MES ready)
            data = {
                'price': price,
                'bid': tick.bid,
                'ask': tick.ask,
                'volume': volume,
                'poc': profile['poc'],
                'vah': profile['vah'],
                'val': profile['val'],
                'buy_ratio': round(buy_ratio, 3),
                'sell_ratio': round(sell_ratio, 3),
                'signal': signal,
                'contract': f"{es_contract.localSymbol}",
                'mes_contract': mes_contract.localSymbol if 'mes_contract' in locals() else 'MESZ5'
            }
            await sio.emit('marketData', data)

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")
    ib.disconnect()

print("IB GATEWAY + ESZ5 OBSERVATION + MESZ5 READY")
