<template>

  <v-container>
    <div class="text-h4 mb-6">
      Arbeitsaufträge
    </div>

    <v-card>
      <v-tabs
        v-model="tab"
        bg-color="primary"
      >
        <v-tab value="one">Texte, die Melodie benötigen</v-tab>
        <v-tab value="two">Texte, die Bearbeitung benötigen</v-tab>
        <v-tab value="three">Melodien, die Bearbeitungen benötigen</v-tab>
      </v-tabs>

      <v-card-text>
        <v-window v-model="tab">
          <v-window-item value="one">
            <v-table>
              <thead>
              <tr>
                <th class="text-left">
                  Name
                </th>
                <th class="text-left">
                  Calories
                </th>
              </tr>
              </thead>
              <tbody>
              <tr
                v-for="item in desserts"
                :key="item.name"
              >
                <td>{{ item.name }}</td>
                <td>{{ item.calories }}</td>
              </tr>
              </tbody>
            </v-table>
          </v-window-item>

          <v-window-item value="two">
            Two
          </v-window-item>

          <v-window-item value="three">
            Three
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-container>

</template>

<script>
export default {
  name: "WorkOrders",
  data: () => ({
    tab: null,
    desserts: [
      {
        name: 'Frozen Yogurt',
        calories: 159,
      },
      {
        name: 'Ice cream sandwich',
        calories: 237,
      },
      {
        name: 'Eclair',
        calories: 262,
      },
      {
        name: 'Cupcake',
        calories: 305,
      },
      {
        name: 'Gingerbread',
        calories: 356,
      },
      {
        name: 'Jelly bean',
        calories: 375,
      },
      {
        name: 'Lollipop',
        calories: 392,
      },
      {
        name: 'Honeycomb',
        calories: 408,
      },
      {
        name: 'Donut',
        calories: 452,
      },
      {
        name: 'KitKat',
        calories: 518,
      },
    ],
  }),
}
</script>

<style scoped>

</style>
