// Función auxiliar para obtener notas de un item
function getNotes(item) {
  const notes = [];

  if (item?.individuals && Array.isArray(item.individuals)) {
    item.individuals.forEach(individual => {
      if (individual.notes) notes.push(individual.notes);
      if (individual.notas) notes.push(individual.notas);
    });
  } else if (item?.notas && Array.isArray(item.notas)) {
    notes.push(...item.notas);
  } else if (item?.notas) {
    if (typeof item.notas === 'string') {
      try {
        const parsed = JSON.parse(item.notas);
        notes.push(...(Array.isArray(parsed) ? parsed : [item.notas]));
      } catch {
        notes.push(item.notas);
      }
    } else {
      notes.push(item.notas);
    }
  }

  return notes.filter(Boolean);
}

module.exports = {
  getNotes
};
