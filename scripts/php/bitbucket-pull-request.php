<?php

/**
 *
 * Bitbucket pull requester (opens browser)
 *
 */

// Check if git exists in current directory.
if (!is_dir(getcwd().'/.git')) {
    echo '!! ERROR: No git repository found in current directory.'.PHP_EOL;
    exit(1);
}

// Check special words
if (isset($argv[1]) && !isset($argv[2])) {
    $specialWords = [
        'r' => '',
        's' => 'src',
        'c' => 'commits',
        'b' => 'branches',
        'p' => 'pull-requests',
    ];

    if (in_array($argv[1], array_keys($specialWords))) {
        openWebsite($specialWords[$argv[1]]);
    }
}


$firstArg = $argv[1] ?? null;
$secondArg = $argv[2] ?? null;

$currentBranch = exec('git symbolic-ref --short HEAD');

if ($firstArg === 'dt' && is_null($secondArg)) {
    $firstArg = 'dev';
    $secondArg = 'test';
}

if ($firstArg === 'tr' && is_null($secondArg)) {
    $firstArg = 'test';
    $secondArg = 'release';
}

if (!is_null($firstArg) && is_null($secondArg)) {
    $secondArg = $firstArg;
    $firstArg = $currentBranch;
}

if (is_null($firstArg)) {
    $firstArg = $currentBranch;
}

if (is_null($secondArg)) {
    $secondArg = 'dev';

    if (strpos($firstArg, 'feature/') !== false) {
        $secondArg = 'dev';
    }

     if (strpos($firstArg, 'bugfix/') !== false) {
        $secondArg = 'dev';
    }

    if ($firstArg === 'dev') {
        $secondArg = 'test';
    }

    if ($firstArg === 'test') {
        $secondArg = 'release';
    }

    if (strpos($firstArg, 'hotfix/') !== false) {
        $secondArg = 'release';
    }

    if ($firstArg === 'release') {
        $secondArg = 'master';
    }
}

openWebsite("pull-requests/new?source=$firstArg&dest=$secondArg&t=1");

function openWebsite($path = null) {
    $gitRemoteUrl = exec('git config --get remote.origin.url');

    // example string: "git@bitbucket.org:semiherdogan/myproject.git"
    preg_match('/.+bitbucket\.org\:(.+)\.git$/i', $gitRemoteUrl, $matches);

    if (isset($matches[1])) {
        exec('open "https://bitbucket.org/'.$matches[1].'/'.$path.'"');
    } else {
        echo '!! ERROR: cannot get url path from '.$gitRemoteUrl . PHP_EOL;
    }

    exit;
}
