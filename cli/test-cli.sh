#!/bin/bash

# Test script for ARC CLI
# Requires server running on localhost:8080

set -e

echo "🧪 Testing ARC CLI..."
echo

# Test 1: Ping
echo "Test 1: Ping relay"
node bin/arc ping --token agent-test-1
echo

# Test 2: Send simple message
echo "Test 2: Send simple message"
node bin/arc send "Hello network" --token agent-test-2
echo

# Test 3: Send typed message
echo "Test 3: Send typed message"
node bin/arc send "What is consciousness?" --token agent-test-3 --type question
echo

# Test 4: Send JSON
echo "Test 4: Send JSON payload"
node bin/arc send '{"findings":["A","B"],"confidence":0.9}' --token agent-test-4 --json --type data
echo

# Test 5: Environment variable
echo "Test 5: Using ARC_TOKEN env var"
export ARC_TOKEN=agent-test-5
node bin/arc ping
echo

echo "✅ All tests passed!"
