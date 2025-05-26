const colors = [
  'rgba(29, 140, 248, 0.8)',
  'rgba(225, 78, 202, 0.8)',
  'rgba(0, 242, 195, 0.8)',
  'rgba(255, 141, 114, 0.8)',
  'rgba(255, 214, 102, 0.8)'
]

export function getRandomColor() {
  const index = Math.floor(Math.random() * colors.length)
  return colors[index]
}

export function getColorByIndex(index) {
  return colors[index % colors.length]
} 