##
# Bitbucket PR
#
# https://developer.atlassian.com/bitbucket/api/2/reference/resource/
#
# Uses bitbucket auth token ($BITBUCKET_AUTH_TOKEN)
#
# Requires "curl" and "jq"
##

_BT_CURRENT_PR_NUMBER=

bpr-set() {
    _BT_CURRENT_PR_NUMBER=$1
}

_bpr_get() {
    if [[ "$1" == "" ]]; then
        echo "$_BT_CURRENT_PR_NUMBER"
    else
        echo "$1"
    fi
}

_bitbucket_api_request() {
    local REPO_URL=$(git config --get remote.origin.url)
    if [[ $REPO_URL == "" ]]; then
        echo "Not a .git repository"

        return 1 2>/dev/null
        exit 1
    fi

    local REPO_PATH=$(echo $REPO_URL | sed 's/.*://; s/\.git//') # semiherdogan/my-project

    curl -s --location --request $1 \
        "https://api.bitbucket.org/2.0/repositories/$REPO_PATH/$2" \
        --header "Authorization: Basic $BITBUCKET_AUTH_TOKEN" \
        ${@:3}
}

_bpr_request() {
    _bitbucket_api_request $1 "pullrequests/$2" ${@:3}
}

bpr-list() {
    _bpr_request GET "?state=OPEN" \
    | jq '.values[] | {
        Id: .id,
        Author: .author.nickname,
        Source: .source.branch.name,
        Destination: .destination.branch.name,
        Link: .links.html.href
    }'
}

bpr-review() {
    local _TO_MERGE_BRANCH=$(
        _bpr_request GET "$(_bpr_get $1)" | jq --raw-output '.destination.branch.name'
    );

    git reset --hard && git clean -df
    git checkout "$_TO_MERGE_BRANCH"
    git pull

    pr-diff "$(_bpr_get $1)" | git apply -
}

bpr-diff() {
    _bpr_request GET "$(_bpr_get $1)/diff"
}

bpr-approve() {
    _bpr_request POST "$(_bpr_get $1)/approve"
}

bpr-un-approve() {
    _bpr_request DELETE "$(_bpr_get $1)/approve"
}

bpr-request-changes() {
    _bpr_request POST "$(_bpr_get $1)/request-changes"
}

bpr-un-request-changes() {
    _bpr_request DELETE "$(_bpr_get $1)/request-changes"
}

bpr-decline() {
    _bpr_request POST "$(_bpr_get $1)/decline"
}

bpr-commits() {
    _bpr_request GET "$(_bpr_get $1)/commits" | jq '.values[].summary.raw'
}

bpr-merge() {
    _bpr_request POST "$(_bpr_get $1)/merge"
}

bpr-create() {
    local _PR_TITLE="$3"

    if [[ "$3" == "" ]]; then
        _PR_TITLE="Merge $1 into $2"
    fi;

    _bpr_request POST "" \
        --header 'Content-Type: application/json' \
        --data '{
            "title": "'"$_PR_TITLE"'",
            "source": {
                "branch": {
                    "name": "'"$1"'"
                }
            },
            "destination": {
                "branch": {
                    "name": "'"$2"'"
                }
            }
        }' \
        | jq '. | {
            Id: .id,
            Link: .links.html.href
        }'
}

bpr-pipeline() {
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
        Completed: .completed_on
    }"
}

bpr-pipeline-listen() {
    local PIPELINE_NUMBER=""
    local PIPELINE_RESPONSE=""

    echo -e "Pending\c"

    while true
    do
        PIPELINE_RESPONSE=$(pr-pipeline $PIPELINE_NUMBER)
        echo -e ".\c"

        if [[ "$PIPELINE_NUMBER" == "" ]]; then
            PIPELINE_NUMBER=$(echo $PIPELINE_RESPONSE | jq --raw-output '.Pipeline')
        fi

        if [[ $(echo $PIPELINE_RESPONSE | jq --raw-output '.State') == "COMPLETED" ]]; then
            break
        fi

        sleep 1
    done

    echo ""
    echo $PIPELINE_RESPONSE | jq '.'
}
