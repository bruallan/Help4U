fetch('http://localhost:3000/api/vmpay/products')
  .then(res => res.json())
  .then(data => {
     console.log("Total products:", data.length);
     const eligible = data.filter(p => p.tags && p.tags.some(t => t.toLowerCase() === 'impulso'));
     console.log("Eligible products:", eligible.length);
     console.log(eligible.map(p => ({ id: p.id, name: p.name, tags: p.tags })));
  })
  .catch(console.error);
