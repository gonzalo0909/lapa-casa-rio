echo "🧪 Testing Payment APIs - Lapa Casa Hostel"
echo "=========================================="

API_BASE="http://localhost:3001/api"

# Test PIX payment creation
echo "1. Testing PIX payment creation..."
curl -X POST "$API_BASE/payments/create" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BKG-TEST-001",
    "method": "pix",
    "guestInfo": {
      "name": "Test User",
      "email": "test@example.com"
    }
  }' | jq '.'

echo -e "\n2. Testing invalid payment method..."
curl -X POST "$API_BASE/payments/create" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BKG-TEST-001",
    "method": "invalid",
    "guestInfo": {
      "name": "Test User", 
      "email": "test@example.com"
    }
  }' | jq '.'

echo -e "\n3. Testing payment status check..."
curl "$API_BASE/payments/non-existent/status" | jq '.'

echo -e "\n✅ Payment API tests completed"

# Hacer ejecutable: chmod +x scripts/test-payments.sh
