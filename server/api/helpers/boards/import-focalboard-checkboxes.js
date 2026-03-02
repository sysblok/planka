/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');

/**
 * @description :: Imports Focalboard checkboxes as Planka TaskLists and Tasks.
 *                 Creates one TaskList named "Checklist" per card, containing all checkboxes as Tasks.
 */

module.exports = {
  inputs: {
    checkboxes: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard checkbox blocks',
    },
    cardIdMapping: {
      type: 'ref',
      required: true,
      description: 'Map of Focalboard card ID to Planka card ID',
    },
  },

  async fn(inputs) {
    const { checkboxes, cardIdMapping } = inputs;

    console.log('');
    console.log('=== Importing Checkboxes ===');
    console.log(`Total checkboxes to import: ${checkboxes.length}`);

    const stats = {
      totalTaskListsCreated: 0,
      totalTasksCreated: 0,
      tasksCompleted: 0,
      skippedNoCard: 0,
      skippedNoTitle: 0,
    };

    if (checkboxes.length === 0) {
      console.log('No checkboxes to import');
      return stats;
    }

    // Group checkboxes by card (parentId)
    const checkboxesByCardId = {};
    for (const checkbox of checkboxes) {
      const focalboardCardId = checkbox.parentId;
      if (!checkboxesByCardId[focalboardCardId]) {
        checkboxesByCardId[focalboardCardId] = [];
      }
      checkboxesByCardId[focalboardCardId].push(checkbox);
    }

    console.log(`Cards with checkboxes: ${Object.keys(checkboxesByCardId).length}`);

    // Process checkboxes for each card
    for (const [focalboardCardId, cardCheckboxes] of Object.entries(checkboxesByCardId)) {
      const plankaCardId = cardIdMapping[focalboardCardId];

      if (!plankaCardId) {
        // Card wasn't imported (might have been filtered out)
        stats.skippedNoCard += cardCheckboxes.length;
        continue;
      }

      // Create TaskList for this card
      const taskList = await TaskList.qm.createOne({
        cardId: plankaCardId,
        position: POSITION_GAP,
        name: 'Checklist',
      });

      stats.totalTaskListsCreated += 1;

      // Create Tasks from checkboxes (preserving order from export file)
      for (let index = 0; index < cardCheckboxes.length; index++) {
        const checkbox = cardCheckboxes[index];
        const taskName = checkbox.title?.trim();

        if (!taskName) {
          stats.skippedNoTitle += 1;
          continue;
        }

        const isCompleted = checkbox.fields?.value === true;

        await Task.qm.createOne({
          taskListId: taskList.id,
          position: POSITION_GAP * (index + 1),
          name: taskName,
          isCompleted,
        });

        stats.totalTasksCreated += 1;
        if (isCompleted) {
          stats.tasksCompleted += 1;
        }
      }
    }

    console.log('');
    console.log('--- Checkboxes Import Summary ---');
    console.log(`TaskLists created: ${stats.totalTaskListsCreated}`);
    console.log(`Tasks created: ${stats.totalTasksCreated}`);
    console.log(`Tasks completed: ${stats.tasksCompleted}`);
    console.log(`Skipped (card not found): ${stats.skippedNoCard}`);
    console.log(`Skipped (empty title): ${stats.skippedNoTitle}`);
    console.log('');

    return stats;
  },
};