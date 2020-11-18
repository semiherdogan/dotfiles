/**
{
  "api":1,
  "name":"PHP Array to Object",
  "description":"php array to object",
  "author":"Semih",
  "icon":"quote",
  "tags":"php array to object, to object"
}
**/

function main(state) {
  /*
  > "$data['naber']".replace(/\$(\w+)\['([^']+)'\]/g, "$$$1->$2");
  >>> $data->naber
  */

  state.text = state.text
    .replace(/\$(\w+)\['([^']+)'\]/g, "$$$1->$2");

  state.postInfo('Php array converted to object');
}
