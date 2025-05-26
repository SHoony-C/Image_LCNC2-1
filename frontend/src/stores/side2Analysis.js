import { defineStore } from 'pinia'

export const useSide2AnalysisStore = defineStore('side2Analysis', {
  state: () => ({
    cachedData: null,
    selectedData: [],
    plotData: null,
    selectedDateRange: '7',
    selectedItems: [],
    selectedSubitems: [],
    isLoading: false,
    isImageLoading: false
  }),
  
  actions: {
    async fetchData() {
      if (this.cachedData) {
        console.log('Using cached data:', this.cachedData.length, 'items')
        this.selectedData = this.cachedData
        return
      }

      console.log('Fetching new data from API')
      this.isLoading = true
      try {
        const response = await fetch('http://localhost:8000/api/side2/data')
        const result = await response.json()
        if (result.status === 'success') {
          console.log('Received data from API:', result.data.length, 'items')
          const processedData = result.data.map(item => ({
            ...item,
            image_url: `https://picsum.photos/200/200?random=${item.item_id}${item.subitem_id}`,
            temperature: Math.random() * 30 + 20,
            humidity: Math.random() * 50 + 30,
            pressure: Math.random() * 20 + 1000
          }))
          
          this.selectedData = processedData
          this.cachedData = processedData
          console.log('Data cached:', this.cachedData.length, 'items')
          
          this.plotData = {
            dates: [...new Set(result.data.map(d => d.date))].sort(),
            values: {},
            items: [...new Set(result.data.map(d => d.item_id))]
          }
          
          this.plotData.items.forEach(item => {
            this.plotData.values[item] = result.data
              .filter(d => d.item_id === item)
              .map(d => d.value)
          })
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        this.isLoading = false
      }
    },

    async fetchSelectedData(selectedIds) {
      console.log('Fetching selected data for IDs:', selectedIds.length, 'items')
      this.isImageLoading = true
      try {
        const response = await fetch('http://localhost:8000/api/side2/selected', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(selectedIds)
        })
        const result = await response.json()
        if (result.status === 'success') {
          console.log('Received selected data:', result.data.length, 'items')
          const processedData = result.data.map(item => ({
            ...item,
            image_url: `https://picsum.photos/200/200?random=${item.item_id}${item.subitem_id}`,
            temperature: Math.random() * 30 + 20,
            humidity: Math.random() * 50 + 30,
            pressure: Math.random() * 20 + 1000
          }))
          this.selectedData = processedData
        }
      } catch (error) {
        console.error('Error fetching selected data:', error)
      } finally {
        this.isImageLoading = false
      }
    },

    filterDataByDateRange() {
      if (!this.plotData) return null

      const days = parseInt(this.selectedDateRange)
      const filteredData = {
        dates: this.plotData.dates.slice(-days),
        values: {},
        items: this.plotData.items
      }

      this.plotData.items.forEach(item => {
        filteredData.values[item] = this.plotData.values[item].slice(-days)
      })

      return filteredData
    }
  },

  getters: {
    availableItems: (state) => {
      if (!state.plotData) return []
      return state.plotData.items
    },

    availableSubitems: (state) => {
      if (!state.selectedData) return []
      return [...new Set(state.selectedData.map(d => d.subitem_id))]
    },

    filteredSelectedData: (state) => {
      return state.selectedData.filter(data => {
        const itemMatch = state.selectedItems.length === 0 || state.selectedItems.includes(data.item_id)
        const subitemMatch = state.selectedSubitems.length === 0 || state.selectedSubitems.includes(data.subitem_id)
        return itemMatch && subitemMatch
      })
    }
  }
}) 