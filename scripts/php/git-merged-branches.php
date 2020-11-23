<?php

$data = shell_exec('git ls-remote | grep -v "tags\|HEAD\|From\|/master\|/test\|dev\|release"');

$data = explode(PHP_EOL, trim($data));

$remoteBranchToCheck = 'origin/master';
if (isset($argv[1])) {
    $remoteBranchToCheck = 'origin/'.$argv[1];
}

print_r($data);

foreach ($data as $row) {
    $row = explode('refs/heads/', $row);
    $commitHash = trim($row[0]);
    $branchName = trim($row[1]);

    $result = shell_exec("git branch -r --contains $commitHash | grep '$remoteBranchToCheck' | grep -vi 'head'");

    $isMergedIntoBranch = trim($result) === $remoteBranchToCheck;

    if ($isMergedIntoBranch) {
        echo 'git push origin --delete '.$branchName.PHP_EOL;
    }
}
