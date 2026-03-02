<?php

return [
    'budget_lines' => array_filter(array_map('trim', explode(',', env('IMPREST_BUDGET_LINES', 'OP-01,OP-02,CAPEX-01,CAPEX-02')))),

    'advance_types' => [
        ['value' => 'rental', 'label' => 'Rental Assistance', 'desc' => 'Deposit or advance rent payment', 'icon' => 'home'],
        ['value' => 'medical', 'label' => 'Medical Emergency', 'desc' => 'Urgent healthcare expenses', 'icon' => 'local_hospital'],
        ['value' => 'school', 'label' => 'School Fees', 'desc' => 'Educational fees for dependants', 'icon' => 'school'],
        ['value' => 'funeral', 'label' => 'Funeral Expenses', 'desc' => 'Bereavement-related costs', 'icon' => 'sentiment_sad'],
        ['value' => 'other', 'label' => 'Other', 'desc' => 'Any other approved purpose', 'icon' => 'more_horiz'],
    ],

    'classifications' => array_filter(array_map('trim', explode(',', env('CLASSIFICATION_LEVELS', 'UNCLASSIFIED,RESTRICTED,CONFIDENTIAL,SECRET')))),

    'leave_types' => [
        ['value' => 'annual', 'label' => 'Annual Leave', 'icon' => 'event_available'],
        ['value' => 'sick', 'label' => 'Sick Leave', 'icon' => 'sick'],
        ['value' => 'lil', 'label' => 'Leave in Lieu', 'icon' => 'schedule'],
        ['value' => 'special', 'label' => 'Special Leave', 'icon' => 'star'],
        ['value' => 'maternity', 'label' => 'Maternity Leave', 'icon' => 'child_care'],
        ['value' => 'paternity', 'label' => 'Paternity Leave', 'icon' => 'family_restroom'],
    ],

    'timesheet_projects' => array_filter(array_map('trim', explode('|', env('TIMESHEET_PROJECTS', 'Project A|Project B|Project C|Administration|Other')))),
];
