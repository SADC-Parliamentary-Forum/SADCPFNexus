<?php

return [
    /*
    | When true, close() rejects if the decision has open critical follow-up actions.
    */
    'block_close_with_open_critical_actions' => env('DECISIONS_BLOCK_CLOSE_CRITICAL', true),
];
