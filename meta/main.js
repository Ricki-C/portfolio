import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

let xScale;
let yScale;

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

function renderCommitInfo(data, commits) {
  const stats = d3.select('#stats');
  stats.selectAll('*').remove();

  const dl = stats.append('dl').attr('class', 'stats');

  const totalCommits = commits.length;
  const totalFiles = d3.group(data, (d) => d.file).size;
  const totalLOC = data.length;
  const maxDepth = d3.max(data, (d) => d.depth);
  const longestLine = d3.max(data, (d) => d.length);
  const maxLines = d3.max(commits, (d) => d.totalLines);

  const statItems = [
    ['Commits', totalCommits],
    ['Files', totalFiles],
    ['Total LOC', totalLOC],
    ['Max depth', maxDepth],
    ['Longest line', longestLine],
    ['Max lines', maxLines],
  ];

  for (let [label, value] of statItems) {
    dl.append('dt').text(label);
    dl.append('dd').text(value);
  }
}

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;

  const margin = {
    top: 10,
    right: 10,
    bottom: 30,
    left: 40,
  };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.top, usableArea.bottom]);

  const xAxis = d3.axisBottom(xScale);

  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);

  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  const dots = svg.append('g').attr('class', 'dots');

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);

      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);

      updateTooltipVisibility(false);
    });

  createBrushSelector(svg);
}

function updateScatterPlot(data, commitsToShow) {
  const width = 1000;
  const height = 600;

  const margin = {
    top: 10,
    right: 10,
    bottom: 30,
    left: 40,
  };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commitsToShow, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const xAxis = d3.axisBottom(xScale);
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  // Keep radius based on the full dataset so circle sizes stay comparable
  // across scroll/filter steps instead of rescaling each update.
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);

  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  const dots = svg.select('g.dots');

  const sortedCommits = d3.sort(commitsToShow, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);

      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);

      updateTooltipVisibility(false);
    });
}

function updateFileDisplay(filteredCommits) {
  let lines = filteredCommits.flatMap((d) => d.lines);

  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  let filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append('div').call((div) => {
        let dt = div.append('dt');
        dt.append('code');
        dt.append('small');
        div.append('dd');
      }),
    );

  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer.select('dt > small').text((d) => `${d.lines.length} lines`);

  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

function getCommitFileCount(commit) {
  return d3.rollups(
    commit.lines,
    (D) => D.length,
    (line) => line.file
  ).length;
}

function getCumulativeLines(commit) {
  return commits
    .filter((d) => d.datetime <= commit.datetime)
    .flatMap((d) => d.lines);
}

function renderStory(storySelector, commitsToShow, getStepHTML) {
  d3.select(storySelector)
    .selectAll('.step')
    .data(commitsToShow, (d) => d.id)
    .join('div')
    .attr('class', 'step')
    .html(getStepHTML);
}

function renderScatterStory(commitsToShow) {
  renderStory('#scatter-story', commitsToShow, (d, i) => {
    const fileCount = getCommitFileCount(d);

    return `
      <p>
        On ${d.datetime.toLocaleString('en', {
          dateStyle: 'full',
          timeStyle: 'short',
        })}, I made
        <a href="${d.url}" target="_blank" rel="noopener noreferrer">
          ${i === 0 ? 'my first commit' : `commit ${d.id.slice(0, 7)}`}
        </a>.
      </p>
      <p>
        I edited ${d.totalLines} ${d.totalLines === 1 ? 'line' : 'lines'}
        across ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.
      </p>
    `;
  });
}

function renderFilesStory(commitsToShow) {
  renderStory('#files-story', commitsToShow, (d, i) => {
    const cumulativeLines = getCumulativeLines(d);
    const fileCount = d3.group(cumulativeLines, (line) => line.file).size;

    return `
      <p>
        By ${d.datetime.toLocaleString('en', {
          dateStyle: 'full',
          timeStyle: 'short',
        })}, the codebase had ${cumulativeLines.length}
        ${cumulativeLines.length === 1 ? 'line' : 'lines'}
        across ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.
      </p>
      <p>
        ${i === 0 ? 'The first commit' : `Commit ${d.id.slice(0, 7)}`}
        accounts for ${d.totalLines}
        ${d.totalLines === 1 ? 'visible line' : 'visible lines'} in the unit
        visualization.
      </p>
    `;
  });
}

function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));

  svg.selectAll('.dots, .overlay ~ *').raise();
}

function brushed(event) {
  const selection = event.selection;

  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d)
  );

  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');

  countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const requiredCommits = selectedCommits.length
    ? selectedCommits
    : filteredCommits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1%')(proportion);

    container.innerHTML += `
    <div class="language-item">
        <dt>${language}</dt>
        <dd>${count} lines</dd>
        <dd class="percent">${formatted}</dd>
    </div>
    `;
  }
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;

  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');

  const offset = 12;

  let left = event.clientX + offset;
  let top = event.clientY + offset;

  const tooltipRect = tooltip.getBoundingClientRect();

  // If tooltip goes beyond right edge, move it to the left of cursor
  if (left + tooltipRect.width > window.innerWidth) {
    left = event.clientX - tooltipRect.width - offset;
  }

  // If tooltip goes beyond bottom edge, move it above cursor
  if (top + tooltipRect.height > window.innerHeight) {
    top = event.clientY - tooltipRect.height - offset;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;

  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });

  time.textContent = commit.time;
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

// ===== Slider: filter commits by date =====
function formatCommitMaxTime(commitTime) {
  return commitTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function updateVisualizations(
  nextCommitMaxTime,
  { syncSlider = true, activeCommitId = null } = {}
) {
  const slider = document.getElementById('commit-progress');

  commitMaxTime = nextCommitMaxTime;
  commitProgress = timeScale(commitMaxTime);

  if (syncSlider) {
    slider.value = commitProgress;
  }

  document.getElementById('commit-filter-time').textContent =
    formatCommitMaxTime(commitMaxTime);

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  let filteredData = filteredCommits.flatMap((d) => d.lines);

  renderCommitInfo(filteredData, filteredCommits);
  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);

  activeStoryCommitId = activeCommitId;

  d3.selectAll('.story')
    .selectAll('.step')
    .classed('is-active', (d) => d.id === activeCommitId);
}

function onTimeSliderChange() {
  const sliderValue = Number(document.getElementById('commit-progress').value);
  updateVisualizations(timeScale.invert(sliderValue), { syncSlider: false });
}

function onStepEnter(response) {
  const commit = response.element.__data__;
  updateStoryCommit(commit);
}

function updateStoryCommit(commit) {
  if (!commit || commit.id === activeStoryCommitId) {
    return;
  }

  updateVisualizations(commit.datetime, { activeCommitId: commit.id });
}

function syncStoryToScroll() {
  const stories = [...document.querySelectorAll('.story')];
  const offset = window.innerHeight * 0.25;
  const activeStory =
    stories.find((story) => {
      const rect = story.getBoundingClientRect();
      return rect.top <= offset && rect.bottom >= offset;
    }) || stories[0];
  const steps = [...activeStory.querySelectorAll('.step')];
  let activeStep = steps[0];

  for (const step of steps) {
    if (step.getBoundingClientRect().top <= offset) {
      activeStep = step;
    } else {
      break;
    }
  }

  updateStoryCommit(activeStep?.__data__);
}

function onStoryScroll() {
  if (storyScrollFrame) {
    return;
  }

  storyScrollFrame = requestAnimationFrame(() => {
    storyScrollFrame = null;
    syncStoryToScroll();
  });
}

// ===== Load data and initialize =====
let data = await loadData();
let commits = d3.sort(processCommits(data), (d) => d.datetime);

let commitProgress = 100;

let timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);
let filteredCommits = commits;
let activeStoryCommitId = null;
let storyScrollFrame = null;

let colors = d3.scaleOrdinal(d3.schemeTableau10);

renderScatterPlot(data, commits);
renderScatterStory(commits);
renderFilesStory(commits);

document
  .getElementById('commit-progress')
  .addEventListener('input', onTimeSliderChange);

// Initial render uses the first story step; scrolling advances the filter.
const scrollers = ['#scrolly-1', '#scrolly-2'].map((container) =>
  scrollama()
    .setup({
      container,
      step: `${container} .step`,
      offset: 0.25,
    })
    .onStepEnter(onStepEnter)
);

window.addEventListener('resize', () => {
  scrollers.forEach((scroller) => scroller.resize());
  syncStoryToScroll();
});

window.addEventListener('scroll', onStoryScroll);

updateVisualizations(commits[0].datetime, {
  activeCommitId: commits[0].id,
});
