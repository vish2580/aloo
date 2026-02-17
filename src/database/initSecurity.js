const pool = require('../config/database');

const initSecuritySchema = async () => {
  const client = await pool.connect();
  
  try {
    console.log('Starting security schema initialization...');

    // Create withdrawal_attempts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_attempts (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    console.log('✓ Withdrawal attempts table created');

    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        payload JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) DEFAULT 'success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Audit logs table created');

    // Create idempotency_keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint VARCHAR(255) NOT NULL,
        response JSONB,
        status_code INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
    `);
    console.log('✓ Idempotency keys table created');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_attempts_user_id ON withdrawal_attempts(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(key);
      CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
    `);
    console.log('✓ Indexes created');

    console.log('\n✅ Security schema initialization completed successfully!\n');
  } catch (error) {
    console.error('❌ Error initializing security schema:', error);
    throw error;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  initSecuritySchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = initSecuritySchema;
