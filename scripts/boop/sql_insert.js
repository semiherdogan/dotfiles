/**
{
  "api":1,
  "name":"To Sql insert",
  "description":"To sql insert (first row table name)",
  "author":"Semih",
  "icon":"quote",
  "tags":"text to sql insert query"
}
**/

function main(state) {
  state.fullText = toSqlInsert(state.fullText);

  state.postInfo('Sql insert queries generated');
}

function toSqlInsert(text) {
  const TAB = '\t';
  let Lines = text.split('\n');

  const TableName = Lines[0];
  Lines.shift();

  const Columns = Lines[0].split(TAB);
  Lines.shift();

  let result = [];

  for (let line of Lines) {
    let row = line.split(TAB);
    for(let r in row) {
        row[r] = row[r].trim()

        if (row[r] == '') {
            row[r] = null;
        } else if (isNumeric(row[r])) {
          // row[r] = row[r];
        } else {
            row[r] = `'${row[r]}'`;
        }
    }

    result.push(
      `INSERT INTO ${TableName} (${Columns.join(', ')}) VALUES (${row.join(', ')});`
    );
  }

  return result.join('\n');
}

function isNumeric(value) {
  return !isNaN(value * 1)
}
