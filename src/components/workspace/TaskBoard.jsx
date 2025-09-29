import { useState } from "react";

export function TaskBoard({ roomId }) {
  const [tasks, setTasks] = useState({
    todo: [
      { id: 1, title: 'Setup project repository', description: 'Initialize Git repo and basic structure', assignee: 'John', priority: 'high' },
      { id: 2, title: 'Design user interface', description: 'Create wireframes and mockups', assignee: 'Jane', priority: 'medium' }
    ],
    inProgress: [
      { id: 3, title: 'Implement authentication', description: 'User login and registration system', assignee: 'Mike', priority: 'high' },
    ],
    review: [
      { id: 4, title: 'Code review: API endpoints', description: 'Review REST API implementation', assignee: 'Sarah', priority: 'medium' }
    ],
    done: [
      { id: 5, title: 'Project planning meeting', description: 'Initial project kickoff and planning', assignee: 'Team', priority: 'low' }
    ]
  });

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const columns = [
    { id: 'todo', title: 'To Do', color: 'bg-gray-100', headerColor: 'bg-gray-200' },
    { id: 'inProgress', title: 'In Progress', color: 'bg-blue-100', headerColor: 'bg-blue-200' },
    { id: 'review', title: 'Review', color: 'bg-yellow-100', headerColor: 'bg-yellow-200' },
    { id: 'done', title: 'Done', color: 'bg-green-100', headerColor: 'bg-green-200' }
  ];

  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800'
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;

    const newTask = {
      id: Date.now(),
      title: newTaskTitle,
      description: '',
      assignee: 'You',
      priority: 'medium'
    };

    setTasks(prev => ({
      ...prev,
      todo: [...prev.todo, newTask]
    }));

    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const moveTask = (taskId, fromColumn, toColumn) => {
    const task = tasks[fromColumn].find(t => t.id === taskId);
    if (!task) return;

    setTasks(prev => ({
      ...prev,
      [fromColumn]: prev[fromColumn].filter(t => t.id !== taskId),
      [toColumn]: [...prev[toColumn], task]
    }));
  };

  const deleteTask = (taskId, column) => {
    setTasks(prev => ({
      ...prev,
      [column]: prev[column].filter(t => t.id !== taskId)
    }));
  };

  const TaskCard = ({ task, columnId }) => (
    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</h4>
        <div className="flex space-x-1 ml-2">
          {columnId !== 'done' && (
            <button
              onClick={() => {
                const nextColumn = columnId === 'todo' ? 'inProgress' 
                  : columnId === 'inProgress' ? 'review' 
                  : 'done';
                moveTask(task.id, columnId, nextColumn);
              }}
              className="text-gray-400 hover:text-blue-600 p-1"
              title="Move forward"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <button
            onClick={() => deleteTask(task.id, columnId)}
            className="text-gray-400 hover:text-red-600 p-1"
            title="Delete task"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      
      {task.description && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
      )}
      
      <div className="flex justify-between items-center">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <div className="flex items-center space-x-1">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-xs text-white font-medium">{task.assignee[0]}</span>
          </div>
          <span className="text-xs text-gray-600">{task.assignee}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="card-modern">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Task Board</h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Room: {roomId}</span>
            <button
              onClick={() => setIsAddingTask(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              + Add Task
            </button>
          </div>
        </div>

        {/* Add task form */}
        {isAddingTask && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                autoFocus
              />
              <button
                onClick={addTask}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTaskTitle('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Board */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {columns.map(column => (
            <div key={column.id} className={`${column.color} rounded-lg p-4`}>
              <div className={`${column.headerColor} -mx-4 -mt-4 px-4 py-3 rounded-t-lg mb-4`}>
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-900">{column.title}</h4>
                  <span className="bg-white text-gray-600 text-xs px-2 py-1 rounded-full">
                    {tasks[column.id].length}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {tasks[column.id].map(task => (
                  <TaskCard key={task.id} task={task} columnId={column.id} />
                ))}
                
                {tasks[column.id].length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">📝</div>
                    <p className="text-sm">No tasks yet</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="border-t p-4">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div>
            Total Tasks: {Object.values(tasks).flat().length} • 
            Completed: {tasks.done.length} • 
            In Progress: {tasks.inProgress.length + tasks.review.length}
          </div>
          <div>
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
