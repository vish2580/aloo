# Deployment Checklist

## Pre-Deployment

### 1. Database Setup
- [ ] Create production PostgreSQL database
- [ ] Configure database connection parameters
- [ ] Run `npm run init-db` to create core tables
- [ ] Run `npm run init-promotions` to create promotion tables
- [ ] Run `npm run init-security` to create security tables
- [ ] Verify all tables created successfully
- [ ] Create database user with appropriate permissions
- [ ] Set up database backup schedule

### 2. Environment Configuration
- [ ] Set `NODE_ENV=production`
- [ ] Generate strong JWT_SECRET (32+ characters, random)
- [ ] Configure database credentials (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- [ ] Set appropriate PORT (default: 5000)
- [ ] Review and adjust rate limit values if needed
- [ ] Configure CORS origins for production domains

### 3. Security Review
- [ ] Verify all sensitive endpoints use authentication
- [ ] Confirm rate limiters are applied to all critical routes
- [ ] Check that audit logging is enabled for all sensitive operations
- [ ] Review error messages for information leakage
- [ ] Ensure stack traces are disabled in production
- [ ] Verify idempotency middleware is applied to wallet/game/red-envelope endpoints

### 4. Code Review
- [ ] All database queries use parameterized queries (no SQL injection)
- [ ] Input validation on all user-facing endpoints
- [ ] Proper error handling with try-catch blocks
- [ ] Audit logging for admin actions
- [ ] Withdrawal password safety implemented
- [ ] Balance safeguards in place

### 5. Dependencies
- [ ] Run `npm audit` to check for vulnerabilities
- [ ] Update vulnerable packages
- [ ] Remove unused dependencies
- [ ] Verify all required packages in package.json

## Deployment

### 6. Server Setup
- [ ] Install Node.js (v16+ recommended)
- [ ] Install PostgreSQL (v13+ recommended)
- [ ] Configure firewall (allow HTTPS 443, optionally HTTP 80)
- [ ] Install PM2 or similar process manager
- [ ] Set up SSL/TLS certificate (Let's Encrypt recommended)
- [ ] Configure reverse proxy (nginx/Apache)

### 7. Application Deployment
```bash
# Clone repository
git clone <your-repo-url>
cd luxwin-backend

# Install dependencies
npm install --production

# Set up environment
cp .env.example .env
nano .env  # Edit with production values

# Initialize databases
npm run init-db
npm run init-promotions
npm run init-security

# Start with PM2
pm2 start src/server.js --name luxwin-backend
pm2 save
pm2 startup
```

### 8. SSL/TLS Setup (nginx example)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Post-Deployment

### 9. Verification Tests
- [ ] Health check endpoint: `GET /health`
- [ ] User registration: `POST /api/auth/register`
- [ ] User login: `POST /api/auth/login`
- [ ] Wallet operations (deposit, withdrawal)
- [ ] Game round retrieval and betting
- [ ] Referral system
- [ ] Red envelope claiming
- [ ] Rate limiting (test 429 responses)
- [ ] Idempotency (test duplicate requests)
- [ ] Withdrawal lockout (test 3 failed attempts)

### 10. Monitoring Setup
- [ ] Configure application logging
- [ ] Set up log rotation
- [ ] Monitor PM2 process health
- [ ] Database connection monitoring
- [ ] Disk space monitoring
- [ ] CPU/Memory usage alerts
- [ ] Failed withdrawal attempt alerts
- [ ] Rate limit hit alerts
- [ ] Audit log monitoring

### 11. Backup Configuration
- [ ] Automated daily database backups
- [ ] Backup retention policy (30+ days recommended)
- [ ] Test backup restoration procedure
- [ ] Off-site backup storage
- [ ] Audit log backup (retain longer, 90+ days)

### 12. Documentation
- [ ] API documentation for frontend team
- [ ] Admin panel usage guide
- [ ] Promotion configuration guide
- [ ] Incident response procedures
- [ ] Rollback procedures
- [ ] Contact list for emergencies

## Security Hardening

### 13. Server Hardening
- [ ] Disable root SSH login
- [ ] Use SSH keys (disable password auth)
- [ ] Configure fail2ban
- [ ] Enable firewall (UFW/iptables)
- [ ] Regular security updates (unattended-upgrades)
- [ ] Restrict database access to localhost/app servers only
- [ ] Use separate database user (not postgres/root)

### 14. Application Security
- [ ] Verify helmet middleware is enabled
- [ ] CORS configured for specific domains (not *)
- [ ] Rate limits tuned for production traffic
- [ ] JWT secret is strong and unique
- [ ] Database passwords are strong
- [ ] No sensitive data in logs
- [ ] No hardcoded credentials in code

### 15. Compliance
- [ ] GDPR compliance (if applicable)
- [ ] Data retention policies
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] User data export mechanism
- [ ] Account deletion mechanism

## Maintenance

### 16. Regular Tasks
- [ ] Daily: Review audit logs for suspicious activity
- [ ] Daily: Check application logs for errors
- [ ] Weekly: Review rate limit statistics
- [ ] Weekly: Database performance check
- [ ] Monthly: Security audit
- [ ] Monthly: Dependency updates
- [ ] Quarterly: Penetration testing
- [ ] Yearly: Security policy review

### 17. Incident Response Plan
- [ ] Define severity levels
- [ ] Establish communication channels
- [ ] Create escalation procedures
- [ ] Document common issues and solutions
- [ ] Maintain on-call rotation
- [ ] Regular incident response drills

## Performance Optimization

### 18. Database Optimization
- [ ] Review and optimize slow queries
- [ ] Create indexes on frequently queried columns
- [ ] Configure connection pooling (already in code)
- [ ] Set up read replicas for heavy traffic
- [ ] Regular VACUUM and ANALYZE operations
- [ ] Monitor query performance with pg_stat_statements

### 19. Application Optimization
- [ ] Enable gzip compression in nginx
- [ ] Configure caching headers
- [ ] Optimize JWT token size
- [ ] Review and optimize middleware order
- [ ] Consider Redis for rate limiting (high traffic)
- [ ] Load testing before production

## Launch Readiness

### 20. Final Checklist
- [ ] All pre-deployment tasks completed
- [ ] All deployment tasks completed
- [ ] All post-deployment tasks completed
- [ ] Monitoring active and verified
- [ ] Backups tested and working
- [ ] Team trained on admin operations
- [ ] Emergency contacts documented
- [ ] Rollback plan tested
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Final stakeholder approval

## Contact Information

### Technical Contacts
- **DevOps Lead**: _____________
- **Backend Lead**: _____________
- **Security Officer**: _____________
- **Database Admin**: _____________

### Emergency Contacts
- **24/7 Hotline**: _____________
- **Email**: _____________
- **Slack Channel**: _____________

### Service Providers
- **Hosting Provider**: _____________
- **Database Provider**: _____________
- **SSL Certificate**: _____________
- **Domain Registrar**: _____________

---

**Checklist Version**: 1.0
**Last Updated**: 2024
**Next Review**: _____________

## Notes

Use this section for deployment-specific notes:

