import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];

      let { author, date, time, timezone, datetime } = first;

      let ret = {
        id: commit,
        url: 'https://github.com/ricki-c/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        configurable: false,
        writable: false,
      });

      return ret;
    });
}

function displayStats(data) {
  const stats = document.querySelector('#stats');

  const totalLOC = data.length;
  const totalFiles = d3.group(data, (d) => d.file).size;
  const totalCommits = d3.group(data, (d) => d.commit).size;
  const avgLineLength = d3.mean(data, (d) => d.length);
  const maxDepth = d3.max(data, (d) => d.depth);

  stats.innerHTML = `
    <dl class="stats">
      <dt>Total lines of code</dt>
      <dd>${totalLOC}</dd>

      <dt>Total files</dt>
      <dd>${totalFiles}</dd>

      <dt>Total commits</dt>
      <dd>${totalCommits}</dd>

      <dt>Average line length</dt>
      <dd>${avgLineLength.toFixed(1)}</dd>

      <dt>Maximum depth</dt>
      <dd>${maxDepth}</dd>
    </dl>
  `;
}

let data = await loadData();
let commits = processCommits(data);

renderCommitInfo(data, commits);

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats')
    .append('dl')
    .attr('class', 'stats');

  const totalLOC = data.length;
  const totalCommits = commits.length;
  const totalFiles = d3.group(data, (d) => d.file).size;
  const maxDepth = d3.max(data, (d) => d.depth);
  const longestLine = d3.max(data, (d) => d.length);
  const avgLineLength = d3.mean(data, (d) => d.length);

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(totalLOC);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(totalCommits);

  dl.append('dt').text('Files');
  dl.append('dd').text(totalFiles);

  dl.append('dt').text('Max depth');
  dl.append('dd').text(maxDepth);

  dl.append('dt').text('Longest line');
  dl.append('dd').text(longestLine);

  dl.append('dt').text('Average line length');
  dl.append('dd').text(avgLineLength.toFixed(1));
}