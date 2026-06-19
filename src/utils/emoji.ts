import { Place } from '../types';

export interface PlaceTheme {
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function getPlaceTheme(place: Place): PlaceTheme {
  const name = place.name.toLowerCase();
  const tags = (place.tags || []).map(t => t.toLowerCase());
  
  if (place.type === 'restaurant') {
    // Determine restaurant subsets
    if (tags.includes('sushi') || tags.includes('japanese') || name.includes('sushi') || name.includes('tori')) {
      return {
        emoji: '🍣',
        color: '#dc2626', // Sushi Red
        bgColor: '#fef2f2',
        borderColor: '#fee2e2'
      };
    }
    if (name.includes('hippopotamus') || tags.includes('steakhouse')) {
      return {
        emoji: '🥩',
        color: '#b91c1c', // Steak Deep Red
        bgColor: '#fef2f2',
        borderColor: '#fee2e2'
      };
    }
    if (name.includes('mcdonald') || name.includes('quick') || name.includes('burger King') || tags.includes('fast food')) {
      return {
        emoji: '🍟',
        color: '#eab308', // Fast food yellow
        bgColor: '#fef9c3',
        borderColor: '#fef08a'
      };
    }
    if (name.includes('bokay') || name.includes('bkb') || name.includes('chicken')) {
      return {
        emoji: '🍔',
        color: '#f97316', // Burger orange
        bgColor: '#fff7ed',
        borderColor: '#ffedd5'
      };
    }
    if (name.includes('fredo')) {
      return {
        emoji: '🎶', // Live music and food
        color: '#8b5cf6', // Indigo/violet for musical cafe
        bgColor: '#f5f3ff',
        borderColor: '#ede9fe'
      };
    }
    if (name.includes('dunette')) {
      return {
        emoji: '⛵', // Dunette pontoon beach bar
        color: '#0284c7', // Sky Blue
        bgColor: '#f0f9ff',
        borderColor: '#e0f2fe'
      };
    }
    if (tags.includes('seafood') || name.includes('lobster') || name.includes('crab') || name.includes('piliers') || name.includes('balaou')) {
      return {
        emoji: '🦞',
        color: '#f97316', // Vibrant Orange
        bgColor: '#fff7ed',
        borderColor: '#ffedd5'
      };
    }
    if (tags.includes('beach') || tags.includes('beachfront') || name.includes('beach') || name.includes('sable') || name.includes('petibonum')) {
      return {
        emoji: '🍹',
        color: '#f43f5e', // Rose/Pink Beach cocktail
        bgColor: '#fff1f2',
        borderColor: '#ffe4e6'
      };
    }
    if (tags.includes('fine dining') || tags.includes('romantic') || name.includes('zandoli') || tags.includes('classy')) {
      return {
        emoji: '🍽️',
        color: '#7c3aed', // Purple Fine Dining
        bgColor: '#f5f3ff',
        borderColor: '#eee1ff'
      };
    }
    if (tags.includes('traditional') || tags.includes('creole') || name.includes('chez') || tags.includes('local') || tags.includes('south of island')) {
      return {
        emoji: '🍛',
        color: '#ea580c', // Creole Curry/Warm Orange
        bgColor: '#fff7ed',
        borderColor: '#ffedd5'
      };
    }
    return {
      emoji: '🍴',
      color: '#ea580c', // Default Restaurant Orange
      bgColor: '#fff7ed',
      borderColor: '#ffedd5'
    };
  } else {
    // Determine activity subsets
    if (tags.includes('cinema') || name.includes('cinema') || name.includes('cinéma') || name.includes('rex') || name.includes('madiana')) {
      return {
        emoji: '🎬',
        color: '#e11d48', // Vibrant Rose/Red for movie cinema
        bgColor: '#fff1f2',
        borderColor: '#ffe4e6'
      };
    }
    if (tags.includes('bowling') || name.includes('bowling') || name.includes('plaza')) {
      return {
        emoji: '🎳',
        color: '#4f46e5', // Deep Indigo bowling
        bgColor: '#eef2ff',
        borderColor: '#e0e7ff'
      };
    }
    if (tags.includes('karting') || tags.includes('racing carts') || name.includes('kart') || name.includes('acrokart')) {
      return {
        emoji: '🏎️',
        color: '#059669', // Emerald Racing GP
        bgColor: '#ecfdf5',
        borderColor: '#d1fae5'
      };
    }
    if (tags.includes('laser tag') || name.includes('laser') || tags.includes('arcade')) {
      return {
        emoji: '👾',
        color: '#8b5cf6', // Neon Violet for arcades & lasers
        bgColor: '#f5f3ff',
        borderColor: '#ede9fe'
      };
    }
    if (tags.includes('waterfall') || name.includes('waterfall') || name.includes('cascade')) {
      return {
        emoji: '🏞️',
        color: '#06b6d4', // Vibrant Cyan waterfall
        bgColor: '#ecfeff',
        borderColor: '#cffafe'
      };
    }
    if (tags.includes('beach') || tags.includes('swimming') || name.includes('plage') || name.includes('salines')) {
      return {
        emoji: '🏖️',
        color: '#0284c7', // Sky Blue beach
        bgColor: '#f0f9ff',
        borderColor: '#e0f2fe'
      };
    }
    if (tags.includes('hiking') || tags.includes('trail') || tags.includes('volcano') || tags.includes('mountain') || name.includes('hike') || name.includes('pelée')) {
      return {
        emoji: '🥾',
        color: '#15803d', // Forest Green hiking
        bgColor: '#f0fdf4',
        borderColor: '#dcfce7'
      };
    }
    if (tags.includes('museum') || tags.includes('history') || tags.includes('culture') || tags.includes('esclaves') || name.includes('clément') || name.includes('savane')) {
      return {
        emoji: '🏛️',
        color: '#b45309', // Amber Museum/Historical Pillar
        bgColor: '#fef3c7',
        borderColor: '#fde68a'
      };
    }
    if (tags.includes('rum tasting') || name.includes('distillery') || name.includes('distillerie')) {
      return {
        emoji: '🥃',
        color: '#d97706', // Rich Gold Rum glass
        bgColor: '#fffbeb',
        borderColor: '#fef3c7'
      };
    }
    if (tags.includes('garden') || tags.includes('botanical') || name.includes('jardin') || tags.includes('nature') || tags.includes('nature reserve')) {
      return {
        emoji: '🌿',
        color: '#10b981', // Natural Emerald herb leaf
        bgColor: '#f0fdf4',
        borderColor: '#dcfce7'
      };
    }
    
    // Catch-all activity
    return {
      emoji: '🏄',
      color: '#0284c7', // Aquatic Ocean Sea Blue
      bgColor: '#f0f9ff',
      borderColor: '#e0f2fe'
    };
  }
}
