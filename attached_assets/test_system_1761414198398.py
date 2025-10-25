# Test sistema base
import numpy as np
import pandas as pd
from datetime import datetime

print("="*50)
print("Order Flow System - Test")
print("="*50)

# Test calcolo VWAP
prices = [5500, 5502, 5501, 5503, 5505]
volumes = [1000, 1200, 900, 1100, 1000]

total_pv = sum(p * v for p, v in zip(prices, volumes))
total_v = sum(volumes)
vwap = total_pv / total_v

print(f"\nTest VWAP Calculation:")
print(f"Prices: {prices}")
print(f"Volumes: {volumes}")
print(f"VWAP: {vwap:.2f}")

# Test Cumulative Delta
cd = 0
for i, p in enumerate(prices):
    if i > 0:
        if p > prices[i-1]:
            cd += volumes[i]
        else:
            cd -= volumes[i]
    print(f"Bar {i}: Price {p}, Volume {volumes[i]}, CD: {cd:+d}")

print("\n✅ Sistema base funziona!")
print("="*50)
