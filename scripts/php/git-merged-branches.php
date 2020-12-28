<?php

$data = shell_exec('git ls-remote | grep -v "tags\|HEAD\|From\|/master\|/test\|dev\|release"');

$data = explode(PHP_EOL, trim($data));

echo PHP_EOL;
print_r($data);
echo PHP_EOL;

$remoteBranchToCheck = 'origin/master';
if (isset($argv[1])) {
    $remoteBranchToCheck = 'origin/'.$argv[1];
}

$branchAuthorsData = explode(
    PHP_EOL,
    trim(
        shell_exec('git for-each-ref --format="%(refname:strip=3)---%(authorname)" --sort=authordate refs/remotes')
    )
);

$branchAuthors = [];
foreach ($branchAuthorsData as $key => $value) {
    $value = explode('---', $value);
    $branchAuthors[$value[0]] = $value[1];
}

foreach ($data as $row) {
    $row = explode('refs/heads/', $row);
    $commitHash = trim($row[0]);
    $branchName = trim($row[1]);

    $result = shell_exec("git branch -r --contains $commitHash | grep '$remoteBranchToCheck' | grep -vi 'head'");

    $isMergedIntoBranch = trim($result) === $remoteBranchToCheck;

    if ($isMergedIntoBranch) {
        echo 'git push origin --delete '.$branchName.' # AUTHOR: '.($branchAuthors[$branchName] ?? '').PHP_EOL;
    }
}
