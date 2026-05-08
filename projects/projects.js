import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

let query = '';
let selectedYear = null;

applyFilters();

let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  applyFilters();
});

function applyFilters() {
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    let matchesSearch = values.includes(query.toLowerCase());
    let matchesYear = selectedYear === null || project.year == selectedYear;

    return matchesSearch && matchesYear;
  });

  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);
}

function renderPieChart(projectsGiven) {
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year
  );

  let data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let sliceGenerator = d3.pie().value((d) => d.value);

  let arcData = sliceGenerator(data);
  let arcs = arcData.map((d) => arcGenerator(d));

  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  let svg = d3.select('#projects-pie-plot');
  svg.selectAll('path').remove();

  let legend = d3.select('.legend');
  legend.selectAll('li').remove();

  arcs.forEach((arc, idx) => {
    svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(idx))
      .attr('class', data[idx].label == selectedYear ? 'selected' : '')
      .on('click', () => {
        let clickedYear = data[idx].label;
        selectedYear = selectedYear == clickedYear ? null : clickedYear;
        applyFilters();
      });
  });

  data.forEach((d, idx) => {
    legend
      .append('li')
      .attr('class', d.label == selectedYear ? 'legend-item selected' : 'legend-item')
      .attr('style', `--color: ${colors(idx)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

const projectsTitle = document.querySelector('.projects-title');

if (projectsTitle) {
  projectsTitle.textContent = `${projects.length} Projects`;
}

