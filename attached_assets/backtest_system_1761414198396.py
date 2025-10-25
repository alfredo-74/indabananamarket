"""
Test rapido sistema
"""

print("="*50)
print("Testing Order Flow System...")
print("="*50)

# Test 1: Import
print("\n1. Testing imports...")
try:
    from src.regime_system import FullyAutomatedOrderFlowSystem
    print("   ✅ Sistema importato")
except Exception as e:
    print(f"   ❌ Errore: {e}")
    exit(1)

# Test 2: Inizializzazione
print("\n2. Testing inizializzazione...")
try:
    system = FullyAutomatedOrderFlowSystem(
        initial_capital=10000,
        auto_trade_enabled=True
    )
    print("   ✅ Sistema inizializzato")
except Exception as e:
    print(f"   ❌ Errore: {e}")
    exit(1)

# Test 3: Process tick
print("\n3. Testing process tick...")
try:
    from datetime import datetime
    system.process_tick(
        timestamp=datetime.now(),
        price=5500,
        volume=5000,
        cumulative_delta=100,
        high=5502,
        low=5498
    )
    print("   ✅ Tick processato")
except Exception as e:
    print(f"   ❌ Errore: {e}")
    exit(1)

# Test 4: Status
print("\n4. Testing status...")
try:
    status = system.get_status()
    print(f"   ✅ Capital: ${status['capital']:.2f}")
    print(f"   ✅ Open trades: {status['open_trades']}")
except Exception as e:
    print(f"   ❌ Errore: {e}")
    exit(1)

print("\n" + "="*50)
print("✅ TUTTI I TEST PASSATI!")
print("Sistema pronto per uso!")
print("="*50)
