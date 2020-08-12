<?php

date_default_timezone_set('Europe/Istanbul');

$data = json_decode(file_get_contents('https://corona.lmao.ninja/v2/countries/turkey'), true);

echo 'Update date: '.date('Y-m-d H:i:s', substr($data['updated'], 0, -3)).PHP_EOL;
echo 'Country:     Turkey'.PHP_EOL.PHP_EOL;

$headers = [
    'cases',
    'todayCases',
    'deaths',
    'todayDeaths',
    'recovered',
    'active',
    'critical',
];

// fixed width
$mask = "%10.10s | %-10.10s \n";

foreach ($headers as $header) {
    printf($mask, ucfirst($header), $data[$header]);
}
