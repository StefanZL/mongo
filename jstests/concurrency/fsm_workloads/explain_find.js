/**
 * explain_find.js
 *
 * Runs explain() and find() on a collection.
 *
 */
import {extendWorkload} from "jstests/concurrency/fsm_libs/extend_workload.js";
import {$config as $baseConfig} from "jstests/concurrency/fsm_workloads/explain.js";
import {isIxscan, planHasStage} from "jstests/libs/analyze_plan.js";

export const $config = extendWorkload($baseConfig, function($config, $super) {
    $config.states = Object.extend({
        explainLimit: function explainLimit(db, collName) {
            var res = db[collName].find().limit(3).explain();
            assertAlways.commandWorked(res);
            assertAlways(planHasStage(db, res.queryPlanner.winningPlan, 'LIMIT'));
        },
        explainBatchSize: function explainBatchSize(db, collName) {
            var res = db[collName].find().batchSize(3).explain();
            assertAlways.commandWorked(res);
        },
        explainAddOption: function explainAddOption(db, collName) {
            var res = db[collName].explain().find().addOption(DBQuery.Option.exhaust).finish();
            assertAlways.commandWorked(res);
        },
        explainSkip: function explainSkip(db, collName) {
            var res = db[collName].explain().find().skip(3).finish();
            assertAlways.commandWorked(res);
            assertAlways(planHasStage(db, res.queryPlanner.winningPlan, 'SKIP'));
        },
        explainSort: function explainSort(db, collName) {
            var res = db[collName].find().sort({i: -1}).explain();
            assertAlways.commandWorked(res);
            assertAlways(planHasStage(db, res.queryPlanner.winningPlan, 'SORT'));
        },
        explainHint: function explainHint(db, collName) {
            assertWhenOwnColl(function() {
                var res = db[collName].find().hint({j: 1}).explain();
                assertWhenOwnColl.commandWorked(res);
                assertWhenOwnColl(isIxscan(db, res.queryPlanner.winningPlan));
            });
        },
        explainMaxTimeMS: function explainMaxTimeMS(db, collName) {
            var res = db[collName].find().maxTimeMS(2000).explain();
            assertAlways.commandWorked(res);
        },
    },
                                   $super.states);

    $config.transitions = Object.extend(
        {explain: $config.data.assignEqualProbsToTransitions($config.states)}, $super.transitions);

    // doubling number of iterations so there is a higher chance we will
    // transition to each of the 8 new states at least once
    $config.iterations = $super.iterations * 2;

    return $config;
});
