const http = require('http');

const profile = encodeURIComponent(JSON.stringify({
  skills: [
    { name: 'JavaScript', proficiency: 'Advanced', category: 'programming' },
    { name: 'React', proficiency: 'Intermediate', category: 'frontend' },
    { name: 'Node.js', proficiency: 'Intermediate', category: 'backend' },
    { name: 'Communication', proficiency: 'Intermediate', category: 'soft-skills' }
  ],
  year: 'second-year',
  location: 'Remote'
}));

http.get('http://localhost:4000/api/opportunities/match?studentProfile=' + profile, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try { console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch(e) { console.log(data); }
  });
});
