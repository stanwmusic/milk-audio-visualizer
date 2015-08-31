/**
 * milkshake -- WebGL Milkdrop-esque visualisation (port of projectM)
 * Copyright (C)2011 Matt Gattis and contributors
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 * See 'LICENSE.txt' included within this release
 *
 */

define(function () {

    var RenderItemMergeFunction = Class({

        typeIdPair: function () {
            return 0;
        }
    });

    var RenderItemMerge = Class({
        extends: RenderItemMergeFunction,

        supported: function () {
            return false;
        },

        typeIdPair: function () {
            return ["", ""];
        },

    });

    var ShapeMerge = Class({
        extends: RenderItemMerge
    });

    var BorderMerge = Class({
        extends: RenderItemMerge
    });

    var MasterRenderItemMerge = Class({
        extends: RenderItemMerge,
        constructor: function () {
            this.mergeFunctionMap = {};
        },

        add: function (fun) {
            this.mergeFunctionMap[fun.typeIdPair()] = fun;
        }

    });

    return {
        MasterRenderItemMerge: MasterRenderItemMerge,
        ShapeMerge: ShapeMerge,
        BorderMerge: BorderMerge
    };
});