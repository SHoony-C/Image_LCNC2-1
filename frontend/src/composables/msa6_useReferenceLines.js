/**
 * msa6_useReferenceLines.js
 * Reference line state and color selection.
 */
import { ref } from 'vue';

export function useReferenceLines(deps) {
  // deps: { render }

  const referenceLines = ref([]);
  const activeReferenceLine = ref(null);
  const referenceLineColor = ref('#ff9900');
  const showReferenceColorPicker = ref(false);
  const referenceColorOptions = ref([
    '#ff9900', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffffff',
  ]);
  const referenceId = ref(1);

  function selectReferenceColor(color) {
    referenceLineColor.value = color;
    showReferenceColorPicker.value = false;
    referenceLines.value.forEach((line) => {
      line.color = color;
    });
    deps.render();
  }

  return {
    referenceLines,
    activeReferenceLine,
    referenceLineColor,
    showReferenceColorPicker,
    referenceColorOptions,
    referenceId,
    selectReferenceColor,
  };
}
