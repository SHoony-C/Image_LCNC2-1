import { defineComponent } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default defineComponent({
  name: 'LineChart',
  components: {
    Line
  },
  props: {
    chartData: {
      type: Object,
      required: true
    },
    options: {
      type: Object,
      default: () => ({
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          position: 'top',
          labels: {
            color: '#9A9A9A',
            boxWidth: 10
          }
        },
        tooltips: {
          bodySpacing: 4,
          mode: 'nearest',
          intersect: 0,
          position: 'nearest',
          xPadding: 10,
          yPadding: 10,
          caretPadding: 10
        },
        scales: {
          y: {
            grid: {
              color: "rgba(225,78,202,0.1)",
              drawBorder: false,
            },
            ticks: {
              color: "#9A9A9A"
            }
          },
          x: {
            grid: {
              display: false,
              drawBorder: false,
            },
            ticks: {
              padding: 20,
              color: "#9A9A9A"
            }
          }
        }
      })
    }
  },
  setup(props) {
    return () => (
      <Line
        data={props.chartData}
        options={props.options}
      />
    )
  }
}) 