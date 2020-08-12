<?php

$link = $argv[1] ?? null;

if (is_null($link)) {
    echo 'ERROR: Link required.'.PHP_EOL;
    exit(1);
}

$fileName = basename($link);
$fileContent = file_get_contents($link);

file_put_contents('./'.$fileName, $fileContent);

$filePath = getcwd().'/'.$fileName;

echo 'File: '.$filePath.PHP_EOL;
echo 'Size: '.filesize_formatted($filePath).PHP_EOL;

function filesize_formatted($path) {
    $size = filesize($path);
    $units = array( 'B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB');
    $power = $size > 0 ? floor(log($size, 1024)) : 0;
    return number_format($size / pow(1024, $power), 2, '.', ',') . ' ' . $units[$power];
}
