// @ts-check
import { defineConfig } from 'astro/config';

// Rehype plugin that tags the OUTERMOST block-level prose elements with
// dir="auto", so each block picks its own bidi direction from the first
// strong character of its content. Arabic blocks resolve to RTL (so
// :dir(rtl) matches AND CSS direction flips, fixing inset-inline-start,
// list-marker side, and text-alignment) without per-block authoring or
// client-side JS.
//
// Critical detail: the HTML5 dir="auto" algorithm excludes text inside any
// descendant that has its OWN dir attribute. So if we tag <ul>, <li>, and
// the inner <p>, each one excludes the others — they all fall back to the
// parent direction (LTR from <html lang="en">) and the list breaks. We fix
// this by walking with an `inside` flag that tracks whether we're already
// nested under a dir-bearing ancestor; we only add dir="auto" when not
// already nested.
function rehypeAddDirAuto() {
  const targets = new Set([
    'p', 'li', 'ul', 'ol',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote',
  ]);
  return (tree) => {
    const walk = (node, insideDirAncestor) => {
      let setHere = false;
      if (
        node.type === 'element' &&
        targets.has(node.tagName) &&
        !insideDirAncestor
      ) {
        node.properties = node.properties || {};
        if (node.properties.dir == null) {
          node.properties.dir = 'auto';
          setHere = true;
        }
      }
      if (node.children) {
        const childInside = insideDirAncestor || setHere;
        node.children.forEach((c) => walk(c, childInside));
      }
    };
    walk(tree, false);
  };
}

export default defineConfig({
  markdown: {
    rehypePlugins: [rehypeAddDirAuto],
  },
});
