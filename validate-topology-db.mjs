

const BASE_URL = 'http://localhost:9051/api';

const log = (msg, color = 'white') => {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        white: '\x1b[37m'
    };
    console.log(`${colors[color]}${msg}\x1b[0m`);
};

async function validateTopologyDB() {
    log('\n╔════════════════════════════════════════════════════════════════════╗', 'blue');
    log('║             TOPOLOGY DATABASE VALIDATION                          ║', 'blue');
    log('╚════════════════════════════════════════════════════════════════════╝\n', 'blue');

    try {
        // 1. Clear Topology DB
        log('1. Clearing Topology Database...', 'white');
        const clearRes = await fetch(`${BASE_URL}/admin/database/topology/clear`, { method: 'POST' });
        if (!clearRes.ok) throw new Error(`Failed to clear DB: ${clearRes.statusText}`);
        log('✅ Topology DB cleared', 'green');

        // 2. Verify Empty
        log('2. Verifying DB is empty...', 'white');
        const emptyRes = await fetch(`${BASE_URL}/transform/topology/latest`);
        const emptyData = await emptyRes.json();
        if (emptyData.nodes.length > 0) throw new Error('DB not empty after clear');
        log('✅ DB is empty', 'green');

        // 3. Generate Topology (Trigger Build & Save to DB)
        log('3. Generating Topology (Build & Save)...', 'white');
        const genRes = await fetch(`${BASE_URL}/transform/topology`, { method: 'POST' });
        if (!genRes.ok) throw new Error(`Failed to generate topology: ${genRes.statusText}`);
        const genData = await genRes.json();
        log(`✅ Generated: ${genData.nodes.length} nodes, ${genData.links.length} links`, 'green');

        // 4. Verify Persistence (Get Latest from DB)
        log('4. Verifying Persistence (Get Latest from DB)...', 'white');
        const latestRes = await fetch(`${BASE_URL}/transform/topology/latest`);
        const latestData = await latestRes.json();

        log(`📊 Retrieved: ${latestData.nodes.length} nodes, ${latestData.links.length} links`, 'cyan');

        if (latestData.nodes.length !== genData.nodes.length) {
            throw new Error(`Node count mismatch: Generated ${genData.nodes.length}, Retrieved ${latestData.nodes.length}`);
        }

        if (latestData.metadata.source !== 'database') {
            throw new Error(`Source is not database: ${latestData.metadata.source}`);
        }

        log('✅ Data persisted correctly in DB', 'green');

        log('\n╔════════════════════════════════════════════════════════════════════╗', 'green');
        log('║                  ✅ TOPOLOGY VALIDATION SUCCESSFUL ✅             ║', 'green');
        log('╚════════════════════════════════════════════════════════════════════╝\n', 'green');

    } catch (error) {
        log('\n╔════════════════════════════════════════════════════════════════════╗', 'red');
        log('║                  ❌ TOPOLOGY VALIDATION FAILED ❌                 ║', 'red');
        log('╚════════════════════════════════════════════════════════════════════╝\n', 'red');
        console.error(error);
        process.exit(1);
    }
}

validateTopologyDB();
