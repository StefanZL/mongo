/**
 * Tests batched deletes with 'gWiredTigerCursorCacheSize=0', to see if there are any use-after-free
 * bugs due to cursor lifetime. This test is only expected to catch regressions in ASAN variants.
 *
 * @tags: [
 *  does_not_support_transactions,
 *  exclude_from_large_txns,
 *  requires_sharding,
 * ]
 */
(function() {
"use strict";

if (!_isAddressSanitizerActive()) {
    jsTestLog("Skipping " + jsTestName() + " because address sanitizer is not active.");
}

load("jstests/libs/fail_point_util.js");  // For 'configureFailPoint()'
load("jstests/libs/parallelTester.js");   // For 'startParallelShell()'

var st =
    new ShardingTest({shards: 1, rs: {nodes: 1, setParameter: {wiredTigerCursorCacheSize: 0}}});

const primary = st.s0;
const rsPrimary = st.rs0.getPrimary();
const db = primary.getDB('test');
const coll = db.test;

assert.commandWorked(primary.adminCommand({shardCollection: 'test.test', key: {_id: 1}}));

const docIds = Array.from(Array(10).keys());
assert.commandWorked(coll.insert(docIds.map((x) => {
    return {_id: x, x: x};
})));

const throwWriteConflictExceptionInBatchedDeleteStage =
    configureFailPoint(rsPrimary, "throwWriteConflictExceptionInBatchedDeleteStage");

function performBatchedDelete() {
    const testDB = db.getMongo().getDB("test");
    const coll = testDB.test;
    const result = assert.commandWorked(coll.remove({x: {$gte: 0}}));
    jsTestLog('delete result: ' + tojson(result));
}

const awaitBatchedDelete = startParallelShell(performBatchedDelete, primary.port);

throwWriteConflictExceptionInBatchedDeleteStage.wait();

jsTestLog("update documents");
assert.commandWorked(coll.update({}, {$inc: {x: -docIds.length}}));

throwWriteConflictExceptionInBatchedDeleteStage.off();

awaitBatchedDelete();

st.stop();
})();
