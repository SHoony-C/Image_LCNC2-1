<template>
  <div class="msa3-container">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-images"></i>
        <span>Image Display Assistant</span>
      </div>
    </div>

    <div class="content-area">
      <div v-if="!mainImage" class="empty-state">
        <div class="welcome-content">
          <div class="welcome-icon-container">
            <i class="fas fa-image main-icon"></i>
          </div>
          <h3>이미지 뷰어</h3>
          <p class="instruction">그래프에서 이미지 포인트를 선택하거나<br>이미지를 업로드하세요.</p>


        </div>
      </div>

      <div v-else class="image-display">
        <div class="selected-image">
          <h4>선택된 이미지: {{ getCleanFilename(mainImage.filename) }}</h4>
          <div class="image-tag" :class="{ 'tag-iapp': isIAppTag(mainImage.filename), 'tag-analysis': !isIAppTag(mainImage.filename) }">
            <i :class="isIAppTag(mainImage.filename) ? 'fas fa-cogs' : 'fas fa-chart-bar'"></i>
            <span>{{ isIAppTag(mainImage.filename) ? 'I-TAP' : 'Analysis' }}</span>
          </div>
          <!-- 유사도 표시 (MSA1에서 온 경우에만 표시) -->
          <div v-if="mainImage && mainImage.fromMSA1" class="selected-similarity">
            <i class="fas fa-percentage"></i>
            <span>{{ formatSimilarity(mainImage.similarity || 0) }}% 유사</span>
          </div>
          <div class="image-wrapper" @click="showImageDetailsPopup(mainImage.filename)">
            <img v-if="mainImage" :src="mainImage.url" :alt="mainImage.filename" @error="handleImageError" @load="handleImageLoad" />
          </div>
        </div>

        <div class="similar-images">
          <div class="similar-section-headers">
            <h4 class="similar-section-title iapp-title">I-TAP 유사 이미지</h4>
            <h4 class="similar-section-title analysis-title">Analysis 유사 이미지</h4>
          </div>

          <div class="dual-column-grid">
            <!-- I-TAP 태그 유사 이미지 -->
            <div class="column iapp-column">
              <div
                v-for="image in iAppSimilarImages"
                :key="image.filename"
                class="similar-image-item"
                @click="selectSimilarImage(image)"
              >
                <img :src="image.url" :alt="image.filename" @error="handleImageError" @load="handleImageLoad" />
                <div class="similarity-score">{{ formatSimilarity(image.similarity) }}% 유사</div>
              </div>
            </div>

            <!-- Analysis 태그 유사 이미지 -->
            <div class="column analysis-column">
              <div
                v-for="image in analysisSimilarImages"
                :key="image.filename"
                class="similar-image-item"
                @click="selectSimilarImage(image)"
              >
                <img :src="image.url" :alt="image.filename" @error="handleImageError" @load="handleImageLoad" />
                <div class="similarity-score">{{ formatSimilarity(image.similarity) }}% 유사</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 이미지 상세 팝업 -->
    <Teleport to="body">
      <!-- I-TAP 태그 팝업 -->
      <ImageIAppPopup
        v-if="showImagePopup && isIAppTag(selectedImage?.filename)"
        :show="showImagePopup"
        :imageUrl="getImageUrl(selectedImage?.filename)"
        :imageName="selectedImage?.filename"
        :image="selectedImage"
        @close="closeImagePopup"
      />

      <!-- Analysis 태그 팝업 -->
      <ImageAnalysisPopup
        v-if="showImagePopup && !isIAppTag(selectedImage?.filename)"
        :show="showImagePopup"
        :imageUrl="getImageUrl(selectedImage?.filename)"
        :imageName="selectedImage?.filename"
        @close="closeImagePopup"
        @analyze="handleAnalyzeRequest"
      />
    </Teleport>
  </div>
</template>

<script>
import '@/assets/css/msa3_image_display.css'
import ImageIAppPopup from './msa3_image_iapp_popup.vue';
import ImageAnalysisPopup from './msa3_image_analysis_popup.vue';
import { useLifecycle } from '../composables/msa3_useLifecycle'

export default {
  name: 'MSA3ImageDisplay',
  components: {
    ImageIAppPopup,
    ImageAnalysisPopup
  },
  setup(props, { emit }) {
    return useLifecycle(emit)
  }
}
</script>

<style scoped>
</style>
