#!/bin/bash

echo "🔍 Verifying Mula ERP System..."
echo ""

# Check Docker services
echo "📦 Docker Services:"
docker compose ps
echo ""

# Check backend health
echo "🏥 Backend Health Check:"
curl -s http://localhost:8080/api/v1/health | python3 -m json.tool 2>/dev/null || echo "Backend not responding"
echo ""

# Check frontend
echo "🎨 Frontend Check:"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend is accessible at http://localhost:5173"
else
    echo "❌ Frontend is not accessible"
fi
echo ""

# Check database
echo "🗄️  Database Check:"
docker compose exec -T postgres pg_isready -U mulaerp 2>/dev/null && echo "✅ PostgreSQL is ready" || echo "❌ PostgreSQL is not ready"
echo ""

# Check cache
echo "💾 Cache Check:"
docker compose exec -T valkey valkey-cli -a mulaerp-redis-password PING 2>/dev/null && echo "✅ Valkey is responding" || echo "❌ Valkey is not responding"
echo ""

echo "✨ Verification Complete!"
echo ""
echo "If all checks passed, you can access the application at:"
echo "  🌐 http://localhost:5173"
echo ""
echo "Login with:"
echo "  📧 Email: admin@mulaerp.com"
echo "  🔑 Password: admin123"
