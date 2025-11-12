import React from 'react'
import ReactDOM from 'react-dom/client'

const App = () => {
  return (
    <div style={{ padding: '20px', background: '#000', color: '#0f0', fontFamily: 'Arial' }}>
      <h1>F1 COMMAND CENTER — LIVE</h1>
      <p>Python Bridge: <span id="py">Connecting...</span></p>
      <p>Contract: <span id="contract">ESZ5</span> | MES: <span id="mes">MESZ5</span></p>
      <p>Price: <span id="price">0.00</span> | Volume: <span id="volume">0</span></p>
      <p>POC: <span id="poc">0</span> | VAH: <span id="vah">0</span> | VAL: <span id="val">0</span></p>
      <p>Buy Ratio: <span id="buy_ratio">0</span> | Sell Ratio: <span id="sell_ratio">0</span></p>
      <h2 style={{ color: '#ff0' }} id="signal">NEUTRAL</h2>
      <button onclick={() => socket.emit('toggle_auto', { enabled: true })}>TOGGLE AUTO</button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

const socket = io('http://localhost:8765')
socket.on('connect', () => document.getElementById('py')!.textContent = 'CONNECTED')
socket.on('marketData', (d: any) => {
  document.getElementById('contract')!.textContent = d.contract
  document.getElementById('mes')!.textContent = d.mes_contract
  document.getElementById('price')!.textContent = d.price
  document.getElementById('volume')!.textContent = d.volume
  document.getElementById('poc')!.textContent = d.poc
  document.getElementById('vah')!.textContent = d.vah
  document.getElementById('val')!.textContent = d.val
  document.getElementById('buy_ratio')!.textContent = d.buy_ratio
  document.getElementById('sell_ratio')!.textContent = d.sell_ratio
  const s = document.getElementById('signal')!
  s.textContent = d.signal
  s.style.color = d.signal === 'BUY' ? '#0f0' : d.signal === 'SELL' ? '#f00' : '#ff0'
})
