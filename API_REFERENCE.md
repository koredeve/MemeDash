# MemeDash API Reference

**Base URL:** `https://memedash-xxxxx.vercel.app` (production)  
**Local Dev:** `http://localhost:3000` (when using `vercel dev`)

---

## Scanner Integration

### GET /api/scanner/latest
Fetch latest tokens detected by the scanner.

**Query Parameters:**
- None required

**Response:**
```json
{
  "success": true,
  "count": 20,
  "tokens": [
    {
      "id": "uuid",
      "mint": "EPjFWaLb3DqV",
      "name": "USDC",
      "symbol": "USDC",
      "score": 85,
      "liquidity": 500000,
      "volume_5m": 250000,
      "volume_24h": 2500000,
      "fdv": 5000000,
      "age_minutes": 2,
      "fomo_score": 75,
      "detected_at": "2026-08-11T12:30:00Z",
      "last_updated": "2026-08-11T12:35:00Z"
    }
  ]
}
```

### GET /api/scanner/status
Get current scanner health status.

**Response:**
```json
{
  "success": true,
  "status": {
    "id": "00000000-0000-0000-0000-000000000001",
    "last_scan_time": "2026-08-11T12:35:00Z",
    "scan_count": 1250,
    "tokens_detected_today": 45,
    "alerts_sent_today": 12,
    "is_healthy": true,
    "error_message": null,
    "updated_at": "2026-08-11T12:35:00Z"
  }
}
```

---

## Watchlist Management

### POST /api/watchlist/add
Add a token to user's watchlist.

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "token_mint": "EPjFWaLb3DqV",
  "notes": "Good potential" // optional
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Token added to watchlist",
  "data": {
    "id": "watchlist-uuid",
    "user_id": "user-uuid",
    "token_mint": "EPjFWaLb3DqV",
    "added_at": "2026-08-11T12:35:00Z"
  }
}
```

**Duplicate Response (409):**
```json
{
  "error": "Token already in watchlist"
}
```

### DELETE /api/watchlist/remove
Remove a token from user's watchlist.

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "token_mint": "EPjFWaLb3DqV"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token removed from watchlist"
}
```

### GET /api/watchlist
Get user's complete watchlist.

**Query Parameters:**
- `user_id` (required): User UUID

**Response:**
```json
{
  "success": true,
  "count": 5,
  "watchlist": [
    {
      "id": "watchlist-uuid",
      "token_mint": "EPjFWaLb3DqV",
      "added_at": "2026-08-11T10:00:00Z",
      "source": "dashboard",
      "tokens": {
        "name": "USDC",
        "symbol": "USDC",
        "score": 85,
        "liquidity": 500000,
        "volume_5m": 250000,
        "age_minutes": 2
      }
    }
  ]
}
```

---

## Alert Rules

### POST /api/rules
Create new alert rule for user (or update default).

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "min_score": 70,           // optional, default 70
  "min_liquidity": 50000,    // optional, default 50000
  "max_age_minutes": 5,      // optional, default 5
  "alert_channels": ["telegram"]  // optional
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Rule created",
  "rule": {
    "id": "rule-uuid",
    "user_id": "user-uuid",
    "min_score": 70,
    "min_liquidity": 50000,
    "max_age_minutes": 5,
    "alert_channels": ["telegram"],
    "enabled": true
  }
}
```

### GET /api/rules
Get user's alert rules.

**Query Parameters:**
- `user_id` (required): User UUID

**Response:**
```json
{
  "success": true,
  "rules": [
    {
      "id": "rule-uuid",
      "user_id": "user-uuid",
      "min_score": 70,
      "min_liquidity": 50000,
      "max_age_minutes": 5,
      "alert_channels": ["telegram"],
      "enabled": true
    }
  ]
}
```

### PUT /api/rules
Update existing alert rule.

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "rule_id": "rule-uuid",
  "min_score": 75,              // optional
  "min_liquidity": 60000,       // optional
  "max_age_minutes": 10,        // optional
  "alert_channels": ["telegram", "dashboard"],  // optional
  "enabled": false              // optional
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Rule updated",
  "rule": {
    "id": "rule-uuid",
    "user_id": "user-uuid",
    "min_score": 75,
    "min_liquidity": 60000,
    "max_age_minutes": 10,
    "alert_channels": ["telegram", "dashboard"],
    "enabled": false
  }
}
```

---

## Alert History

### GET /api/alerts/history
Get user's alert history with pagination.

**Query Parameters:**
- `user_id` (required): User UUID
- `limit` (optional): Results per page, default 50
- `offset` (optional): Page offset, default 0

**Example:** `/api/alerts/history?user_id=uuid&limit=20&offset=0`

**Response:**
```json
{
  "success": true,
  "total": 127,
  "limit": 20,
  "offset": 0,
  "history": [
    {
      "id": "alert-uuid",
      "user_id": "user-uuid",
      "token_mint": "EPjFWaLb3DqV",
      "token_name": "USDC",
      "token_symbol": "USDC",
      "score": 85,
      "liquidity": 500000,
      "alert_type": "rule_match",
      "channels_sent": ["telegram"],
      "sent_at": "2026-08-11T12:30:00Z"
    }
  ]
}
```

---

## Telegram Integration

### POST /api/telegram/webhook
Receive Telegram bot commands. **Must be configured as Telegram webhook URL.**

**Telegram Sends (Automatic):**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 987654321,
      "is_bot": false,
      "first_name": "John"
    },
    "chat": {
      "id": 987654321,
      "type": "private"
    },
    "date": 1691743200,
    "text": "/add SOL"
  }
}
```

**Available Commands:**
- `/start` - Welcome and help
- `/add <symbol>` - Add token to watchlist
- `/remove <symbol>` - Remove from watchlist
- `/watchlist` - Show watchlist
- `/rules` - Show alert rules
- `/setrule <setting> <value>` - Update rule
  - Settings: `minscore`, `minliquidity`, `maxage`
  - Example: `/setrule minscore 75`
- `/history` - Show recent alerts
- `/pause` - Disable alerts
- `/resume` - Enable alerts

**Response (200):**
```json
{
  "success": true
}
```

### POST /api/telegram/send
Send alert to user via Telegram. **Called by alert engine.**

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "token_mint": "EPjFWaLb3DqV",
  "token_name": "USDC",
  "token_symbol": "USDC",
  "score": 85,
  "liquidity": 500000
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Alert sent to Telegram"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found or not connected to Telegram"
}
```

---

## Dashboard

### GET /api/dashboard/status
Get dashboard overview status.

**Query Parameters:**
- `user_id` (required): User UUID

**Response:**
```json
{
  "success": true,
  "status": {
    "scanner": {
      "healthy": true,
      "last_scan": "2026-08-11T12:35:00Z",
      "tokens_today": 45
    },
    "user": {
      "watchlist_count": 5,
      "alerts_today": 3,
      "rules_enabled": true
    }
  }
}
```

### GET /api/dashboard/tokens
Get latest tokens with watchlist indicators.

**Query Parameters:**
- `user_id` (required): User UUID
- `limit` (optional): Number of tokens, default 20

**Response:**
```json
{
  "success": true,
  "latest_count": 20,
  "watchlist_count": 5,
  "tokens": [
    {
      "id": "token-uuid",
      "mint": "EPjFWaLb3DqV",
      "name": "USDC",
      "symbol": "USDC",
      "score": 85,
      "liquidity": 500000,
      "volume_5m": 250000,
      "age_minutes": 2,
      "fomo_score": 75,
      "detected_at": "2026-08-11T12:30:00Z",
      "in_watchlist": true
    }
  ]
}
```

### GET /api/dashboard/stats
Get analytics and statistics.

**Query Parameters:**
- `user_id` (required): User UUID

**Response:**
```json
{
  "success": true,
  "stats": {
    "alerts": {
      "today": 3,
      "yesterday": 5,
      "week": 25,
      "trend": "-40%"
    },
    "tokens": {
      "unique_today": 3,
      "avg_score": 82.5,
      "watchlist_count": 5,
      "avg_watchlist_liquidity": 425000
    }
  }
}
```

---

## Error Responses

### 400 Bad Request
Missing or invalid parameters.

```json
{
  "success": false,
  "error": "Missing user_id query parameter"
}
```

### 404 Not Found
Resource not found.

```json
{
  "success": false,
  "error": "Token not found in recent scans"
}
```

### 409 Conflict
Resource already exists (e.g., duplicate watchlist entry).

```json
{
  "success": false,
  "error": "Token already in watchlist"
}
```

### 500 Internal Server Error
Server error, check logs.

```json
{
  "success": false,
  "error": "Database connection failed"
}
```

---

## Testing Endpoints

### cURL Examples

**Add to watchlist:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-123","token_mint":"EPjFWaLb3DqV"}' \
  https://memedash.vercel.app/api/watchlist/add
```

**Get watchlist:**
```bash
curl "https://memedash.vercel.app/api/watchlist?user_id=user-123"
```

**Get dashboard stats:**
```bash
curl "https://memedash.vercel.app/api/dashboard/stats?user_id=user-123"
```

### JavaScript/Fetch Examples

```javascript
// Add to watchlist
const response = await fetch('/api/watchlist/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 'user-123',
    token_mint: 'EPjFWaLb3DqV'
  })
});

const data = await response.json();
console.log(data);
```

---

## Rate Limiting

Currently no rate limiting. Production should consider:
- 100 requests/minute per IP
- 1000 requests/hour per user
- Implement via Vercel middleware

---

## Authentication

Current phase uses **user_id** in query/body for identification.

**Future improvements:**
- JWT tokens for API authentication
- OAuth2 integration for dashboard users
- API key system for programmatic access

---

**Last Updated:** 2026-08-11  
**API Version:** 1.0 (Phase 1)  
**Status:** Production Ready
