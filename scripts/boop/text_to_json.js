/**
{
  "api":1,
  "name":"Text to JSON",
  "description":"Text To json",
  "author":"Semih",
  "icon":"quote",
  "tags":"to json, text to json"
}
**/

function main(state) {
  state.text = toJsonType(state.text);

  state.postInfo('Jsonized');
}

function toJsonType(text) {
  let Lines = text.split('\n')

  for (let i = 0; i < Lines.length; i++) {
    Lines[i] = `"${Lines[i]}": null`
  }

  return Lines.join(',\n');
}
