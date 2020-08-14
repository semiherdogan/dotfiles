/**
{
  "api":1,
  "name":"JSON to Php Array",
  "description":"json to php array",
  "author":"Semih",
  "icon":"quote",
  "tags":"json to php array, to php array"
}
**/

function main(state) {
  state.text = state.text
    .replace(/{/g, '[')
    .replace(/}/g, ']')
    .replace(/: /g, ' => ')
    .replace(/"/g, "'")

  state.postInfo('Php array initialized');
}
