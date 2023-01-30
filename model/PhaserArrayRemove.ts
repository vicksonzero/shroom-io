/**
 * @author       Richard Davey <rich@photonstorm.com>
 * @copyright    2022 Photon Storm Ltd.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

/**
 * Removes the given item, or array of items, from the array.
 *
 * The array is modified in-place.
 *
 * You can optionally specify a callback to be invoked for each item successfully removed from the array.
 *
 * @function Phaser.Utils.Array.Remove
 * @since 3.4.0
 *
 * @param {array} array - The array to be modified.
 * @param {*|Array.<*>} item - The item, or array of items, to be removed from the array.
 * @param {function} [callback] - A callback to be invoked for each item successfully removed from the array.
 * @param {object} [context] - The context in which the callback is invoked.
 *
 * @return {*|Array.<*>} The item, or array of items, that were successfully removed from the array.
 */
export const Remove = (array: Array<unknown>, item: any, callback?: Function, context?: any) => {
    if (context === undefined) { context = array; }

    var index;

    //  Fast path to avoid array mutation and iteration
    if (!Array.isArray(item)) {
        index = array.indexOf(item);

        if (index !== -1) {
            SpliceOne(array, index);

            if (callback) {
                callback.call(context, item);
            }

            return item;
        }
        else {
            return null;
        }
    }

    //  If we got this far, we have an array of items to remove

    var itemLength = item.length - 1;
    var removed: any[] = [];

    while (itemLength >= 0) {
        var entry = item[itemLength];

        index = array.indexOf(entry);

        if (index !== -1) {
            SpliceOne(array, index);

            removed.push(entry);

            if (callback) {
                callback.call(context, entry);
            }
        }

        itemLength--;
    }

    return removed;
};


/**
 * Removes a single item from an array and returns it without creating gc, like the native splice does.
 * Based on code by Mike Reinstein.
 *
 * @function Phaser.Utils.Array.SpliceOne
 * @since 3.0.0
 *
 * @param {array} array - The array to splice from.
 * @param {number} index - The index of the item which should be spliced.
 *
 * @return {*} The item which was spliced (removed).
 */
const SpliceOne = (array: any[], index: number) => {
    if (index >= array.length) {
        return;
    }

    var len = array.length - 1;

    var item = array[index];

    for (var i = index; i < len; i++) {
        array[i] = array[i + 1];
    }

    array.length = len;

    return item;
};