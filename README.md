# EduHub Notification Service

A scalable microservice for handling email and SMS notifications for EduHub Academy learning management system. Built with Node.js, Redis queue processing, and Azure Communication Service.

## Features

- **Email Notifications**: Send transactional emails via Azure Communication Service
- **SMS Notifications**: Send SMS messages (optional feature)
- **Queue-based Processing**: Async notification processing with Bull and Redis
- **Template System**: Handlebars-based email templates
- **REST API**: Simple API for other services to trigger notifications
- **Scalable**: Kubernetes-ready with HPA support
- **Monitoring**: Health checks, logging, and queue statistics
- **Rate Limiting**: Built-in API rate limiting
- **Retry Logic**: Automatic retry for failed notifications

## Architecture

```
┌─────────────────┐
│  Other Services │
│ (auth, catalog) │
└────────┬────────┘
         │ REST API
         ▼
┌─────────────────────┐
│ Notification Service│
│   (Node.js)         │
└─────────┬───────────┘
          │
          ▼
    ┌─────────┐
    │  Redis  │
    │  Queue  │
    └─────────┘
          │
          ▼
┌──────────────────────┐
│ Azure Communication  │
│      Service         │
└──────────────────────┘
          │
          ▼
    ┌──────────┐
    │ Email/SMS│
    └──────────┘
```

## Prerequisites

- Node.js >= 18.x
- Redis >= 7.x
- Azure Communication Service account
- Docker (optional, for containerization)
- Kubernetes cluster (optional, for production deployment)

## Installation

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd eduhub-notification-service
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your Azure Communication Service credentials:
```env
AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://...;accesskey=...
AZURE_EMAIL_FROM=donotreply@eduhub.academy
AZURE_SMS_CONNECTION_STRING=endpoint=https://...;accesskey=...
AZURE_SMS_FROM=+1234567890
```

4. **Start Redis**
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or using local Redis installation
redis-server
```

5. **Run the service**
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The service will be available at `http://localhost:3000`

### Using Docker Compose

```bash
# Set environment variables
cp .env.example .env
# Edit .env with your Azure credentials

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f notification-service

# Stop services
docker-compose down
```

## API Documentation

### Base URL
- Local: `http://localhost:3000/api/v1`
- Production: `https://api.eduhub.academy/api/v1`

### Authentication
Currently, the API does not require authentication. For production, implement API key or JWT authentication at the API Gateway level.

### Endpoints

#### 1. Send Email Notification
```http
POST /notifications/email
Content-Type: application/json

{
  "to": "student@example.com",
  "subject": "New Assignment Posted",
  "body": "You have a new assignment in Mathematics",
  "isHtml": false,
  "priority": "normal",
  "metadata": {
    "assignmentId": "123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email notification queued",
  "jobId": "12345",
  "data": {
    "to": "student@example.com",
    "subject": "New Assignment Posted"
  }
}
```

#### 2. Send Email with Template
```http
POST /notifications/email
Content-Type: application/json

{
  "to": "student@example.com",
  "subject": "New Assignment: Mathematics Homework",
  "templateId": "assignment-created",
  "templateData": {
    "studentName": "John Doe",
    "courseName": "Mathematics 101",
    "assignmentTitle": "Chapter 5 Exercises",
    "assignmentDescription": "Complete exercises 1-10",
    "dueDate": "2025-10-20T23:59:59Z",
    "points": 100,
    "assignmentUrl": "https://eduhub.academy/assignments/123"
  },
  "priority": "high"
}
```

#### 3. Send SMS Notification
```http
POST /notifications/sms
Content-Type: application/json

{
  "to": "+1234567890",
  "message": "Your assignment deadline is in 2 hours!",
  "priority": "high"
}
```

#### 4. Send Bulk Notifications
```http
POST /notifications/bulk
Content-Type: application/json

{
  "notifications": [
    {
      "type": "email",
      "data": {
        "to": "student1@example.com",
        "subject": "Assignment Reminder",
        "body": "Don't forget to submit your assignment"
      }
    },
    {
      "type": "sms",
      "data": {
        "to": "+1234567890",
        "message": "Assignment due tomorrow!"
      }
    }
  ]
}
```

#### 5. Get Job Status
```http
GET /notifications/job/:jobId
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "12345",
    "type": "email",
    "state": "completed",
    "progress": 100,
    "attemptsMade": 1,
    "processedOn": 1634567890000,
    "finishedOn": 1634567891000,
    "returnvalue": {
      "success": true,
      "messageId": "azure-message-id"
    }
  }
}
```

#### 6. Get Queue Statistics
```http
GET /notifications/queue/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "waiting": 5,
    "active": 2,
    "completed": 1523,
    "failed": 12,
    "delayed": 0,
    "total": 1542
  }
}
```

#### 7. Retry Failed Job
```http
POST /notifications/job/:jobId/retry
```

#### 8. Get Available Templates
```http
GET /notifications/templates
```

**Response:**
```json
{
  "success": true,
  "templates": [
    "assignment-created",
    "deadline-reminder",
    "welcome"
  ],
  "count": 3
}
```

#### 9. Health Check
```http
GET /health
GET /health/detailed
GET /health/ready  # Kubernetes readiness probe
GET /health/live   # Kubernetes liveness probe
```

## Email Templates

Templates are stored in `src/templates/` and use Handlebars syntax.

### Available Templates

1. **assignment-created**: New assignment notification
2. **deadline-reminder**: Assignment deadline reminder
3. **welcome**: Welcome email for new users

### Creating Custom Templates

1. Create a new `.hbs` file in `src/templates/`
2. Use Handlebars syntax for dynamic content
3. Restart the service to load new templates

**Example template (`src/templates/custom.hbs`):**
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
    </style>
</head>
<body>
    <h1>Hello {{userName}}!</h1>
    <p>{{message}}</p>
    <p>Date: {{formatDate date}}</p>
</body>
</html>
```

### Available Handlebars Helpers

- `{{uppercase string}}`: Convert to uppercase
- `{{lowercase string}}`: Convert to lowercase
- `{{formatDate date}}`: Format date (e.g., "October 13, 2025")
- `{{formatDateTime date}}`: Format date with time

## Configuration

All configuration is managed through environment variables. See `.env.example` for all available options.

### Key Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `REDIS_HOST` | Redis hostname | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Azure Email connection string | Required |
| `AZURE_EMAIL_FROM` | From email address | donotreply@eduhub.academy |
| `QUEUE_ATTEMPTS` | Max retry attempts for failed jobs | 3 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

## Deployment

### Docker

Build and run with Docker:

```bash
# Build image
docker build -t eduhub/notification-service:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e REDIS_HOST=redis \
  -e AZURE_COMMUNICATION_CONNECTION_STRING=your-connection-string \
  --name notification-service \
  eduhub/notification-service:latest
```

### Kubernetes

1. **Update secrets**

   Edit `k8s/secret.yaml` with your Azure credentials (or use sealed-secrets/external-secrets in production).

2. **Deploy to Kubernetes**

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n eduhub

# View logs
kubectl logs -f deployment/notification-service -n eduhub

# Check service
kubectl get svc -n eduhub
```

3. **Verify deployment**

```bash
# Port forward to test locally
kubectl port-forward svc/notification-service 3000:80 -n eduhub

# Test health endpoint
curl http://localhost:3000/health
```

### Kubernetes Resources

The service includes:

- **Deployment**: 3 replicas with rolling update strategy
- **Service**: ClusterIP service for internal access
- **HPA**: Auto-scaling based on CPU/memory (3-10 pods)
- **Ingress**: NGINX ingress with TLS
- **ConfigMap**: Non-sensitive configuration
- **Secret**: Sensitive credentials
- **Redis**: Persistent Redis deployment with PVC

### Scaling

The service auto-scales based on:
- CPU utilization > 70%
- Memory utilization > 80%
- Min replicas: 3
- Max replicas: 10

Manual scaling:
```bash
kubectl scale deployment notification-service --replicas=5 -n eduhub
```

## Monitoring & Logging

### Logging

Logs are written to:
- Console (all environments)
- Files in `logs/` directory (production only)
  - `logs/error.log`: Error logs
  - `logs/combined.log`: All logs

Log format: JSON in production, colorized console in development.

### Health Checks

- `/health`: Basic health check
- `/health/detailed`: Detailed health with Redis and queue status
- `/health/ready`: Kubernetes readiness probe
- `/health/live`: Kubernetes liveness probe

### Queue Monitoring

Monitor queue status via the API:

```bash
curl http://localhost:3000/api/v1/notifications/queue/stats
```

## Integration Examples

### From Auth Service (User Registration)

```javascript
const axios = require('axios');

async function sendWelcomeEmail(user) {
  try {
    const response = await axios.post(
      'http://notification-service/api/v1/notifications/email',
      {
        to: user.email,
        subject: 'Welcome to EduHub Academy',
        templateId: 'welcome',
        templateData: {
          userName: user.name,
          userEmail: user.email,
          dashboardUrl: 'https://eduhub.academy/dashboard'
        },
        priority: 'high'
      }
    );
    console.log('Welcome email queued:', response.data.jobId);
  } catch (error) {
    console.error('Failed to queue welcome email:', error.message);
  }
}
```

### From Assignment Service (New Assignment)

```javascript
async function notifyStudentsAboutAssignment(assignment, students) {
  const notifications = students.map(student => ({
    type: 'email',
    data: {
      to: student.email,
      subject: `New Assignment: ${assignment.title}`,
      templateId: 'assignment-created',
      templateData: {
        studentName: student.name,
        courseName: assignment.courseName,
        assignmentTitle: assignment.title,
        assignmentDescription: assignment.description,
        dueDate: assignment.dueDate,
        points: assignment.points,
        assignmentUrl: `https://eduhub.academy/assignments/${assignment.id}`
      }
    }
  }));

  await axios.post(
    'http://notification-service/api/v1/notifications/bulk',
    { notifications }
  );
}
```

### From Assignment Service (Deadline Reminder)

```javascript
// Send SMS reminder 2 hours before deadline
async function sendDeadlineReminder(student, assignment) {
  const timeRemaining = '2 hours remaining';

  // Send email
  await axios.post(
    'http://notification-service/api/v1/notifications/email',
    {
      to: student.email,
      subject: 'Assignment Deadline Approaching!',
      templateId: 'deadline-reminder',
      templateData: {
        studentName: student.name,
        assignmentTitle: assignment.title,
        courseName: assignment.courseName,
        dueDate: assignment.dueDate,
        timeRemaining,
        assignmentUrl: `https://eduhub.academy/assignments/${assignment.id}`
      },
      priority: 'high'
    }
  );

  // Send SMS if phone number available
  if (student.phoneNumber) {
    await axios.post(
      'http://notification-service/api/v1/notifications/sms',
      {
        to: student.phoneNumber,
        message: `Reminder: ${assignment.title} due in 2 hours!`,
        priority: 'high'
      }
    );
  }
}
```

## Troubleshooting

### Service won't start

1. Check Redis connectivity:
```bash
redis-cli ping
```

2. Verify Azure credentials:
```bash
# Check if connection string is set
echo $AZURE_COMMUNICATION_CONNECTION_STRING
```

3. Check logs:
```bash
# Docker
docker logs notification-service

# Kubernetes
kubectl logs deployment/notification-service -n eduhub
```

### Notifications not sending

1. Check job status via API:
```bash
curl http://localhost:3000/api/v1/notifications/job/{jobId}
```

2. Check queue statistics:
```bash
curl http://localhost:3000/api/v1/notifications/queue/stats
```

3. Check failed jobs:
   - Failed jobs are retained for 7 days
   - Review error messages in job status

### High memory usage

1. Clean old completed jobs:
```bash
curl -X POST http://localhost:3000/api/v1/notifications/queue/clean \
  -H "Content-Type: application/json" \
  -d '{"grace": 86400000, "status": "completed"}'
```

2. Adjust queue cleanup settings in `.env`:
```env
QUEUE_CLEANUP_AGE=43200000  # 12 hours instead of 24
```

## Security Considerations

1. **API Authentication**: Implement authentication at API Gateway level
2. **Secrets Management**: Use Kubernetes secrets or external secrets management (HashiCorp Vault, AWS Secrets Manager)
3. **Rate Limiting**: Configured at 100 requests per 15 minutes (adjust as needed)
4. **TLS/SSL**: Enable HTTPS via Ingress with cert-manager
5. **Network Policies**: Restrict pod-to-pod communication
6. **RBAC**: Configure appropriate Kubernetes RBAC policies

## Performance Optimization

1. **Horizontal Scaling**: HPA automatically scales based on load
2. **Queue Concurrency**: Bull processes jobs in parallel (configure in `notificationQueue.js:7`)
3. **Redis Optimization**: Use Redis Cluster for high availability
4. **Template Caching**: Templates are cached in memory after loading
5. **Connection Pooling**: Azure Communication Service SDK handles connection pooling

## Development

### Project Structure

```
eduhub-notification-service/
├── src/
│   ├── config/           # Configuration management
│   ├── middleware/       # Express middleware
│   ├── queues/          # Bull queue processors
│   ├── routes/          # API routes
│   ├── services/        # Business logic (email, SMS, templates)
│   ├── templates/       # Email templates (Handlebars)
│   ├── utils/           # Utilities (logger, validators)
│   └── index.js         # Application entry point
├── k8s/                 # Kubernetes manifests
├── logs/                # Log files (production)
├── .env.example         # Environment variables template
├── Dockerfile           # Docker image definition
├── docker-compose.yml   # Local development setup
└── package.json         # Dependencies and scripts
```

### Running Tests

```bash
npm test
```

### Code Linting

```bash
npm run lint
```

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Email: support@eduhub.academy
