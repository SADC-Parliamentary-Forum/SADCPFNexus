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

    'travel_countries' => [
        'Angola', 'Botswana', 'Comoros', 'Democratic Republic of Congo',
        'Eswatini', 'Lesotho', 'Madagascar', 'Malawi', 'Mauritius',
        'Mozambique', 'Namibia', 'Seychelles', 'South Africa',
        'Tanzania', 'Zambia', 'Zimbabwe',
    ],

    'travel_cities' => [
        'Angola' => ['Luanda', 'Lubango', 'Benguela'],
        'Botswana' => ['Gaborone', 'Francistown', 'Maun'],
        'Comoros' => ['Moroni', 'Mutsamudu'],
        'Democratic Republic of Congo' => ['Kinshasa', 'Lubumbashi', 'Goma'],
        'Eswatini' => ['Mbabane', 'Manzini', 'Lobamba'],
        'Lesotho' => ['Maseru', 'Teyateyaneng', 'Mafeteng'],
        'Madagascar' => ['Antananarivo', 'Toamasina', 'Antsirabe'],
        'Malawi' => ['Lilongwe', 'Blantyre', 'Mzuzu'],
        'Mauritius' => ['Port Louis', 'Curepipe', 'Vacoas-Phoenix'],
        'Mozambique' => ['Maputo', 'Beira', 'Nampula'],
        'Namibia' => ['Windhoek', 'Walvis Bay', 'Rundu'],
        'Seychelles' => ['Victoria', 'Anse Boileau'],
        'South Africa' => ['Pretoria', 'Johannesburg', 'Cape Town', 'Durban', 'Bloemfontein'],
        'Tanzania' => ['Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza'],
        'Zambia' => ['Lusaka', 'Ndola', 'Kitwe', 'Livingstone'],
        'Zimbabwe' => ['Harare', 'Bulawayo', 'Mutare', 'Gweru'],
    ],
];
