<template>
<div style="color:black">
   <q-side-link multiline highlight item v-if="page.SHOW_LD && page.shouldDisplay" :to='to(page)' :key="page.url" v-for="page in pages">
      <q-item-side :icon="page.icon" />
      <q-item-main :label="$t(page.title)"/>
    </q-side-link>
</div>
</template>
<script>
import {
  QSideLink,
  QItemTile,
  QItemSide,
  QItemMain,
  QItemSeparator
} from 'quasar';
export default {
  name: 'pagelinks',
  props: ['pages'],
  watch: {
    pages: function(val) {}
  },
  components: {
    QSideLink,
    QItemTile,
    QItemSide,
    QItemMain,
    QItemSeparator
  },
  methods: {
    to(page) {
      var to;
      to = { name: 'pageManager', params: { pageId: page.url } };
      if (page.internal) {
        to = { name: page.internalUrl };
      }
      return to;
    }
  }
};
</script>
