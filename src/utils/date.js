export function formatLifeRange(birthDate, deathDate) {

  const lines = [];

    if (deathDate.length > 0) {
    lines.push(`Deceased🪦: ${deathDate}`);
  }

  if (birthDate.length > 0) {
    lines.push(`Birthdate: ${birthDate}`);
  } else {
    lines.push(`Birthdate: Unknown`);
  }

  // push line brake into index 1


  return lines

}