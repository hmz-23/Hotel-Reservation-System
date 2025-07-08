import React, { useState, useEffect, useCallback } from 'react';

// Define the Room class
class Room {
    constructor(roomNumber, floor) {
        this.roomNumber = roomNumber;
        this.floor = floor;
        this.isOccupied = false;
    }

    // String representation for debugging
    toString() {
        return `Room ${this.roomNumber} (Floor ${this.floor})`;
    }
}

// Function to calculate travel time between two rooms
// This function calculates the time to go from room1's position to its floor's lift,
// then vertical travel to room2's floor, then horizontal travel to room2's position from its floor's lift.
// This is used for calculating travel time between the first and last room in a *set* of booked rooms.
const calculateTravelTime = (room1, room2) => {
    // Horizontal travel: 1 minute per room
    // Vertical travel: 2 minutes per floor

    // Helper to get the "position" of a room on its floor (1-indexed from lift)
    const getRoomPositionOnFloor = (room) => {
        if (room.floor >= 1 && room.floor <= 9) {
            // Rooms 1-10 on floors 1-9. Room X01 is position 1, X10 is position 10.
            return room.roomNumber % 10 === 0 ? 10 : room.roomNumber % 10;
        } else if (room.floor === 10) {
            // Rooms 1001-1007 on floor 10. Room 1001 is position 1, 1007 is position 7.
            return room.roomNumber - 1000;
        }
        return 0; // Should not happen
    };

    const pos1 = getRoomPositionOnFloor(room1);
    const pos2 = getRoomPositionOnFloor(room2);

    // If rooms are on the same floor, only horizontal travel is considered.
    if (room1.floor === room2.floor) {
        return Math.abs(pos1 - pos2) * 1; // 1 minute per room
    } else {
        // If rooms are on different floors, calculate combined horizontal and vertical travel.
        // Time to reach lift from room1's position on its floor
        const timeToLiftFromRoom1 = (pos1 - 1) * 1; // Room 1 (pos 1) is 0 min from lift

        // Time to reach room2's position from lift on its floor
        const timeFromLiftToRoom2 = (pos2 - 1) * 1;

        // Vertical travel between floors
        const verticalTravelTime = Math.abs(room1.floor - room2.floor) * 2; // 2 minutes per floor

        // Total travel time between two rooms on different floors
        return timeToLiftFromRoom1 + verticalTravelTime + timeFromLiftToRoom2;
    }
};

// Helper function to calculate travel time for a set of rooms (first to last)
const calculateSetTravelTime = (roomSet) => {
    if (roomSet.length <= 1) return 0; // No travel time for 0 or 1 room

    // Sort the rooms first by floor, then by room number to find the true "first" and "last"
    const sortedRooms = [...roomSet].sort((a, b) => {
        if (a.floor !== b.floor) {
            return a.floor - b.floor;
        }
        return a.roomNumber - b.roomNumber;
    });

    const firstRoom = sortedRooms[0];
    const lastRoom = sortedRooms[sortedRooms.length - 1];

    return calculateTravelTime(firstRoom, lastRoom);
};


// Main App Component
const App = () => {
    const [rooms, setRooms] = useState([]);
    const [numRoomsToBook, setNumRoomsToBook] = useState(1);
    const [message, setMessage] = useState('');

    // Initialize rooms on component mount
    useEffect(() => {
        const initialRooms = [];
        // Floors 1-9: 10 rooms each (e.g., 101-110, 201-210)
        for (let floor = 1; floor <= 9; floor++) {
            for (let i = 1; i <= 10; i++) {
                const roomNumber = floor * 100 + i;
                initialRooms.push(new Room(roomNumber, floor));
            }
        }
        // Floor 10 (Top Floor): 7 rooms (1001-1007)
        for (let i = 1; i <= 7; i++) {
            const roomNumber = 1000 + i;
            initialRooms.push(new Room(roomNumber, 10));
        }
        setRooms(initialRooms);
    }, []);

    // Function to find combinations (utility for booking logic)
    const getCombinations = useCallback((array, k) => {
        const result = [];
        function f(prefix, array, k) {
            if (k === 0) {
                result.push(prefix);
                return;
            }
            if (array.length === 0) {
                return;
            }
            const head = array[0];
            const tail = array.slice(1);
            f(prefix.concat(head), tail, k - 1);
            f(prefix, tail, k);
        }
        f([], array, k);
        return result;
    }, []);

    // Main booking logic
    const findBestRoomsToBook = useCallback((requestedNumRooms) => {
        if (requestedNumRooms <= 0 || requestedNumRooms > 5) {
            setMessage('You can book between 1 and 5 rooms.');
            return [];
        }

        const availableRooms = rooms.filter(room => !room.isOccupied);
        if (availableRooms.length < requestedNumRooms) {
            setMessage(`Not enough rooms available. ${availableRooms.length} rooms are free.`);
            return [];
        }

        let bestBookingCandidate = [];
        let minTotalTravelTime = Infinity;

        // --- Rule 1 & 2: Priority is to book rooms on the same floor first, minimizing travel time ---
        for (let floor = 1; floor <= 10; floor++) {
            const availableOnCurrentFloor = rooms.filter(room => !room.isOccupied && room.floor === floor);

            if (availableOnCurrentFloor.length >= requestedNumRooms) {
                const floorCombinations = getCombinations(availableOnCurrentFloor, requestedNumRooms);

                for (const combo of floorCombinations) {
                    const currentTravelTime = calculateSetTravelTime(combo);

                    // If this is the first valid same-floor combo, or better than current best same-floor combo
                    if (currentTravelTime < minTotalTravelTime) {
                        minTotalTravelTime = currentTravelTime;
                        bestBookingCandidate = combo;
                    }
                }
                // If we found a candidate on this floor, it's the best for this floor.
                // We continue iterating floors to find the *absolute best single-floor* option.
                // The problem states "Priority is to book rooms on the same floor first."
                // This means, if *any* valid booking can be made on a single floor, it's preferred over spanning floors.
                // So, after checking all floors, if bestBookingCandidate is not empty, it means we found a single-floor solution.
            }
        }

        if (bestBookingCandidate.length > 0) {
            setMessage(`Found best rooms on floor(s) ${bestBookingCandidate[0].floor} with total travel time: ${minTotalTravelTime} minutes.`);
            return bestBookingCandidate; // Return the best single-floor option found
        }

        // --- Rule 3: If not available on same floor, span across floors, minimizing combined travel time ---
        setMessage('Searching for rooms across multiple floors...');
        minTotalTravelTime = Infinity; // Reset for cross-floor search
        bestBookingCandidate = []; // Reset candidate

        const allAvailableRooms = rooms.filter(room => !room.isOccupied);
        const allCombinations = getCombinations(allAvailableRooms, requestedNumRooms);

        for (const combo of allCombinations) {
            const currentTravelTime = calculateSetTravelTime(combo);

            if (currentTravelTime < minTotalTravelTime) {
                minTotalTravelTime = currentTravelTime;
                bestBookingCandidate = combo;
            }
        }

        if (bestBookingCandidate.length > 0) {
            setMessage(`Found best rooms spanning floors with total travel time: ${minTotalTravelTime} minutes.`);
            return bestBookingCandidate;
        } else {
            setMessage('Could not find suitable rooms based on criteria.');
            return [];
        }
    }, [rooms, getCombinations]); // Dependencies for useCallback

    // Handle booking button click
    const handleBookRooms = () => {
        const roomsToBook = findBestRoomsToBook(parseInt(numRoomsToBook, 10));
        if (roomsToBook.length > 0) {
            setRooms(prevRooms =>
                prevRooms.map(room =>
                    roomsToBook.some(bookedRoom => bookedRoom.roomNumber === room.roomNumber)
                        ? { ...room, isOccupied: true }
                        : room
                )
            );
            setMessage(`Successfully booked rooms: ${roomsToBook.map(r => r.roomNumber).join(', ')}`);
        }
    };

    // Handle reset button click
    const handleResetBookings = () => {
        setRooms(prevRooms => prevRooms.map(room => ({ ...room, isOccupied: false })));
        setMessage('All bookings have been reset.');
    };

    // Handle random occupancy button click
    const handleGenerateRandomOccupancy = () => {
        const totalRooms = rooms.length;
        const numToOccupy = Math.floor(Math.random() * (totalRooms * 0.5 - totalRooms * 0.1) + totalRooms * 0.1); // Occupy 10-50%
        
        const availableRooms = rooms.filter(room => !room.isOccupied);
        // Ensure we don't try to occupy more rooms than available
        const actualNumToOccupy = Math.min(numToOccupy, availableRooms.length);

        const roomsToOccupy = [];
        const tempAvailable = [...availableRooms]; // Create a mutable copy
        for (let i = 0; i < actualNumToOccupy; i++) {
            const randomIndex = Math.floor(Math.random() * tempAvailable.length);
            roomsToOccupy.push(tempAvailable.splice(randomIndex, 1)[0]); // Remove and add
        }

        setRooms(prevRooms =>
            prevRooms.map(room =>
                roomsToOccupy.some(occupiedRoom => occupiedRoom.roomNumber === room.roomNumber)
                    ? { ...room, isOccupied: true }
                    : room
            )
        );
        setMessage(`Generated random occupancy for ${actualNumToOccupy} rooms.`);
    };

    // Group rooms by floor for rendering
    const roomsByFloor = rooms.reduce((acc, room) => {
        if (!acc[room.floor]) {
            acc[room.floor] = [];
        }
        acc[room.floor].push(room);
        return acc;
    }, {});

    // Sort rooms within each floor by room number
    Object.keys(roomsByFloor).forEach(floor => {
        roomsByFloor[floor].sort((a, b) => a.roomNumber - b.roomNumber);
    });

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans flex flex-col items-center">
            <style>
                {`
                body { font-family: 'Inter', sans-serif; }
                .room-grid {
                    display: grid;
                    grid-template-columns: repeat(10, minmax(0, 1fr)); /* 10 columns for rooms */
                    gap: 0.5rem; /* Gap between rooms */
                }
                .floor-label {
                    width: 4rem; /* Fixed width for floor labels */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-weight: 600;
                    background-color: #e2e8f0; /* Gray-200 */
                    border-radius: 0.5rem;
                    padding: 0.5rem;
                }
                .room-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.25rem;
                }
                .room-box {
                    width: 2.5rem; /* Room square size */
                    height: 2.5rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 0.5rem;
                    border: 1px solid #cbd5e0; /* Gray-300 */
                    font-size: 0.75rem; /* text-xs */
                    font-weight: 600;
                    cursor: pointer;
                    transition: background-color 0.2s ease-in-out;
                }
                .room-box.occupied {
                    background-color: #ef4444; /* Red-500 */
                    color: white;
                }
                .room-box.available {
                    background-color: #22c55e; /* Green-500 */
                    color: white;
                }
                .room-box.empty {
                    background-color: #ffffff; /* White */
                    color: #4b5563; /* Gray-600 */
                }
                .room-box:hover {
                    transform: scale(1.05);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                `}
            </style>

            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl mb-8">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Hotel Room Reservation System</h1>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <label htmlFor="numRooms" className="text-gray-700 font-medium">No. of Rooms:</label>
                        <input
                            type="number"
                            id="numRooms"
                            min="1"
                            max="5"
                            value={numRoomsToBook}
                            onChange={(e) => setNumRoomsToBook(e.target.value)}
                            className="w-20 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center"
                        />
                    </div>
                    <button
                        onClick={handleBookRooms}
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Book
                    </button>
                    <button
                        onClick={handleResetBookings}
                        className="px-6 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Reset
                    </button>
                    <button
                        onClick={handleGenerateRandomOccupancy}
                        className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Random
                    </button>
                </div>

                {/* Message Display */}
                {message && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-6 text-center" role="alert">
                        <span className="block sm:inline">{message}</span>
                    </div>
                )}

                {/* Hotel Room Visualization */}
                <div className="flex flex-col gap-2">
                    {Object.keys(roomsByFloor).sort((a, b) => parseInt(b) - parseInt(a)).map(floor => ( // Sort floors descending
                        <div key={floor} className="flex items-center gap-2">
                            {/* Floor Label (Stairs/Lift area) */}
                            <div className="floor-label h-10 w-16 bg-gray-300 rounded-lg flex-shrink-0">
                                {floor === '10' ? '10' : floor}
                            </div>
                            {/* Rooms on the floor */}
                            <div className="room-grid flex-grow">
                                {roomsByFloor[floor].map(room => (
                                    <div
                                        key={room.roomNumber}
                                        className={`room-box ${room.isOccupied ? 'occupied' : 'empty'}`}
                                        title={`Room ${room.roomNumber}, Floor ${room.floor}`}
                                    >
                                        {room.roomNumber}
                                    </div>
                                ))}
                                {/* Fill empty slots for floors 1-9 if they don't have 10 rooms (e.g., floor 10 has 7) */}
                                {floor !== '10' && roomsByFloor[floor].length < 10 && (
                                    Array.from({ length: 10 - roomsByFloor[floor].length }).map((_, i) => (
                                        <div key={`empty-${floor}-${i}`} className="room-box bg-gray-200 cursor-not-allowed"></div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default App;

