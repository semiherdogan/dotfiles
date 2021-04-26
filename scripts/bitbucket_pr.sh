##
# Bitbucket PR
#
# https://developer.atlassian.com/bitbucket/api/2/reference/resource/
#
# Uses bitbucket auth token ($BITBUCKET_AUTH_TOKEN)
##

_CURRENT_PR_NUMBER=

pr-set() {
    _CURRENT_PR_NUMBER=$1
}

_pr_get() {
    if [[ "$1" == "" ]]; then
        echo "$_CURRENT_PR_NUMBER"
    else
        echo "$1"
    fi
}

_get-repo-path() {
    local REPO_URL=$(git config --get remote.origin.url)
    if [[ $REPO_URL == "" ]]; then
        echo "Not a .git repository"

        return 1 2>/dev/null
        exit 1
    fi

    echo $REPO_URL | sed 's/.*://; s/\.git//'
}

_bitbucket_api_request() {
    local REPO_PATH=$(_get-repo-path)

    curl -s --location --request $1 \
        "https://api.bitbucket.org/2.0/repositories/$REPO_PATH/$2" \
        --header "Authorization: Basic $BITBUCKET_AUTH_TOKEN" \
        ${@:3}
}

_pr_request() {
    _bitbucket_api_request $1 "pullrequests/$2" ${@:3}
}

pr-list() {
    _pr_request GET "?state=OPEN" \
    | jq '.values[] | {
        Id: .id,
        Author: .author.nickname,
        Source: .source.branch.name,
        Destination: .destination.branch.name,
        Link: .links.html.href
    }'
}

pr-review() {
    local _TO_MERGE_BRANCH=$(
        _pr_request GET "$(_pr_get $1)" | jq --raw-output '.destination.branch.name'
    );

    git reset --hard && git clean -df
    git checkout "$_TO_MERGE_BRANCH"
    git pull

    pr-diff "$(_pr_get $1)" | git apply -
}

pr-diff() {
    _pr_request GET "$(_pr_get $1)/diff"
}

pr-approve() {
    _pr_request POST "$(_pr_get $1)/approve"
}

pr-un-approve() {
    _pr_request DELETE "$(_pr_get $1)/approve"
}

pr-request-changes() {
    _pr_request POST "$(_pr_get $1)/request-changes"
}

pr-un-request-changes() {
    _pr_request DELETE "$(_pr_get $1)/request-changes"
}

pr-decline() {
    _pr_request POST "$(_pr_get $1)/decline"
}

pr-commits() {
    _pr_request GET "$(_pr_get $1)/commits" | jq '.values[].summary.raw'
}

pr-merge() {
    _pr_request POST "$(_pr_get $1)/merge"
}

pr-create() {
    local CURRENT_BRACH=$(git symbolic-ref --short HEAD)
    local FROM_BRANCH="$1"
    local TO_BRANCH="$2"

    if [[ "$2" == "" ]]; then
        FROM_BRANCH="$CURRENT_BRACH"
        TO_BRANCH="$1"
    fi

    _pr_request POST "" \
        --header 'Content-Type: application/json' \
        --data '{
            "title": "Merge '"$FROM_BRANCH"' into '"$TO_BRANCH"'",
            "source": {
                "branch": {
                    "name": "'"$FROM_BRANCH"'"
                }
            },
            "destination": {
                "branch": {
                    "name": "'"$TO_BRANCH"'"
                }
            }
        }' \
        | jq '. | {
            Id: .id,
            Link: .links.html.href
        }'
}

pr-pipeline() {
    local REPO_PATH=$(_get-repo-path)
    local PIPELINE_NUMBER="$1"
    if [[ "$1" == "" ]]; then
        PIPELINE_NUMBER=$(_bitbucket_api_request GET pipelines/ | jq '.size') # get latest
    fi

    _bitbucket_api_request GET "pipelines/$PIPELINE_NUMBER" | jq ". | {
        Pipeline: $PIPELINE_NUMBER,
        Creator: .creator.display_name,
        Repository: .repository.name,
        Target: .target.ref_name,
        State: .state.name,
        StateResult: .state.result.name,
        Created: .created_on,
        Completed: .completed_on,
        PipelineUrl: \"https://bitbucket.org/$REPO_PATH/addon/pipelines/home#!/results/$PIPELINE_NUMBER\"
    }"
}

pr-pipeline-listen() {
    local PIPELINE_RESPONSE=$(pr-pipeline $1)
    local PIPELINE_NUMBER=$(echo $PIPELINE_RESPONSE | jq --raw-output '.Pipeline')
    local CURRENT_PIPELINE_STATE=$(echo $PIPELINE_RESPONSE | jq --raw-output '.State')

    if [[ $CURRENT_PIPELINE_STATE != "COMPLETED" ]]; then
        echo $PIPELINE_RESPONSE | jq ". | {
            Pipeline: .Pipeline,
            Creator: .Creator,
            State: .State,
            Target: .Target,
            PipelineUrl: .PipelineUrl
        }"

        echo -e "\nPending\c"
    fi

    while [[ $CURRENT_PIPELINE_STATE != "COMPLETED" ]]
    do
        sleep 2
        PIPELINE_RESPONSE=$(pr-pipeline $PIPELINE_NUMBER)
        echo -e ".\c"
    done

    if [[ $CURRENT_PIPELINE_STATE != "COMPLETED" ]]; then
        echo ""
    fi

    echo $PIPELINE_RESPONSE | jq '.'
}
