import React from 'react';
import { useParams } from 'react-router-dom';

const HistoryPage: React.FC = () => {
    const { id } = useParams();

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-985 p-8">
            <h1 className="text-3xl font-bold text-gray-100 mb-4">History Dashboard</h1>
            <p className="text-lg text-gray-400">
                Displaying historical dashboard for item with ID: <span className="font-mono text-gray-100 bg-zinc-800 px-2 py-1 rounded">{id}</span>
            </p>
            <div className="mt-8 p-12 border border-dashed border-zinc-800 rounded-lg w-full max-w-4xl h-96 flex items-center justify-center">
                <p className="text-gray-600">Dashboard content for "{id}" would be rendered here.</p>
            </div>
        </div>
    );
};

export default HistoryPage;